// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package archive

import (
	"archive/tar"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/mholt/archiver/v4"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
)

// TarConfig configures tarbal creation/extraction
type TarConfig struct {
	UIDMaps []IDMapping
	GIDMaps []IDMapping
}

// BuildTarbalOption configures the tarbal creation
type TarOption func(o *TarConfig)

// IDMapping maps user or group IDs
type IDMapping struct {
	ContainerID int
	HostID      int
	Size        int
}

// WithUIDMapping reverses the given user ID mapping during archive creation
func WithUIDMapping(mappings []IDMapping) TarOption {
	return func(o *TarConfig) {
		o.UIDMaps = mappings
	}
}

// WithGIDMapping reverses the given user ID mapping during archive creation
func WithGIDMapping(mappings []IDMapping) TarOption {
	return func(o *TarConfig) {
		o.GIDMaps = mappings
	}
}

// ExtractTarbal extracts an OCI compatible tar file src to the folder dst, expecting the overlay whiteout format
func ExtractTarbal(ctx context.Context, src io.Reader, dst string, opts ...TarOption) (err error) {
	//nolint:staticcheck,ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "extractTarbal")
	span.LogKV("dst", dst)
	defer tracing.FinishSpan(span, &err)

	if err := ctx.Err(); err != nil {
		return err // honor context cancellation
	}

	var cfg TarConfig
	start := time.Now()
	for _, opt := range opts {
		opt(&cfg)
	}

	format := archiver.Tar{}
	handler := func(ctx context.Context, f archiver.File) error {
		if err := ctx.Err(); err != nil {
			return err // honor context cancellation
		}

		header, isTarHeader := f.Header.(*tar.Header)
		if !isTarHeader {
			log.WithField("path", f.NameInArchive).WithField("type", fmt.Sprintf("%T", f.Header)).Warn("invalid tar header")
			return nil
		}

		isSymlink := (header.Linkname != "")
		if isSymlink {
			return nil
		}

		err = untarFile(f, dst, header)
		if err != nil {
			return err
		}

		uid := toHostID(header.Uid, cfg.UIDMaps)
		gid := toHostID(header.Gid, cfg.GIDMaps)

		dstFilePath := filepath.Join(dst, f.NameInArchive)
		err = remapFile(dstFilePath, uid, gid, header.Xattrs)
		if err != nil {
			log.WithError(err).WithField("uid", uid).WithField("gid", gid).WithField("path", dstFilePath).Debug("cannot chown")
		}

		return nil
	}

	err = format.Extract(ctx, src, nil, handler)
	if err != nil {
		return err
	}

	log.WithField("duration", time.Since(start).Milliseconds()).Debug("untar complete")
	return nil
}

func toHostID(containerID int, idMap []IDMapping) int {
	for _, m := range idMap {
		if (containerID >= m.ContainerID) && (containerID <= (m.ContainerID + m.Size - 1)) {
			hostID := m.HostID + (containerID - m.ContainerID)
			return hostID
		}
	}
	return containerID
}

// remapFile changes the UID and GID of a file preserving existing file mode bits.
func remapFile(name string, uid, gid int, xattrs map[string]string) error {
	// current info of the file before any change
	fileInfo, err := os.Stat(name)
	if err != nil {
		return err
	}

	// nothing to do for symlinks
	if fileInfo.Mode()&os.ModeSymlink == os.ModeSymlink {
		return nil
	}

	// changing UID or GID can break files with suid/sgid
	err = os.Lchown(name, uid, gid)
	if err != nil {
		return err
	}

	// restore original permissions
	err = os.Chmod(name, fileInfo.Mode())
	if err != nil {
		return err
	}

	for key, value := range xattrs {
		// do not set trusted attributes
		if strings.HasPrefix(key, "trusted.") {
			continue
		}

		if strings.HasPrefix(key, "user.") {
			// This is a marker to match inodes, such as when an upper layer copies a lower layer file in overlayfs.
			// However, when restoring a content, the container in the workspace is not always running, so there is no problem ignoring the failure.
			if strings.HasSuffix(key, ".overlay.impure") || strings.HasSuffix(key, ".overlay.origin") {
				continue
			}
		}

		if err := unix.Lsetxattr(name, key, []byte(value), 0); err != nil {
			if err == syscall.ENOTSUP || err == syscall.EPERM {
				continue
			}

			log.WithField("name", key).WithField("value", value).WithField("file", name).WithError(err).Warn("restoring extended attributes")
		}
	}

	// restore file times
	fileTime := fileInfo.Sys().(*syscall.Stat_t)
	return os.Chtimes(name, timespecToTime(fileTime.Atim), timespecToTime(fileTime.Mtim))
}

func timespecToTime(ts syscall.Timespec) time.Time {
	return time.Unix(int64(ts.Sec), int64(ts.Nsec))
}

func untarFile(f archiver.File, destination string, hdr *tar.Header) error {
	to := filepath.Join(destination, hdr.Name)

	if !f.IsDir() && fileExists(to) {
		return fmt.Errorf("file already exists: %s", to)
	}

	switch hdr.Typeflag {
	case tar.TypeDir:
		return mkdir(to, f.Mode())
	case tar.TypeReg, tar.TypeRegA, tar.TypeChar, tar.TypeBlock, tar.TypeFifo, tar.TypeGNUSparse:
		return writeNewFile(to, f, f.Mode())
	case tar.TypeSymlink:
		return writeNewSymbolicLink(to, hdr.Linkname)
	case tar.TypeLink:
		return writeNewHardLink(to, filepath.Join(destination, hdr.Linkname))
	case tar.TypeXGlobalHeader:
		return nil // ignore the pax global header from git-generated tarballs
	default:
		return fmt.Errorf("%s: unknown type flag: %c", hdr.Name, hdr.Typeflag)
	}
}

func fileExists(name string) bool {
	_, err := os.Stat(name)
	return !os.IsNotExist(err)
}

func mkdir(dirPath string, dirMode os.FileMode) error {
	err := os.MkdirAll(dirPath, dirMode)
	if err != nil {
		return fmt.Errorf("%s: making directory: %v", dirPath, err)
	}
	return nil
}

func writeNewFile(fpath string, file archiver.File, fm os.FileMode) error {
	err := os.MkdirAll(filepath.Dir(fpath), 0755)
	if err != nil {
		return fmt.Errorf("%s: making directory for file: %v", fpath, err)
	}

	out, err := os.Create(fpath)
	if err != nil {
		return fmt.Errorf("%s: creating new file: %v", fpath, err)
	}
	defer out.Close()

	err = out.Chmod(fm)
	if err != nil {
		return fmt.Errorf("%s: changing file mode: %v", fpath, err)
	}

	in, err := file.Open()
	if err != nil {
		return fmt.Errorf("%s: cannot open file: %v", fpath, err)
	}

	_, err = io.Copy(out, in)
	if err != nil {
		return fmt.Errorf("%s: writing file: %v", fpath, err)
	}

	return nil
}

func writeNewSymbolicLink(fpath string, target string) error {
	err := os.MkdirAll(filepath.Dir(fpath), 0755)
	if err != nil {
		return fmt.Errorf("%s: making directory for file: %v", fpath, err)
	}

	_, err = os.Lstat(fpath)
	if err == nil {
		err = os.Remove(fpath)
		if err != nil {
			return fmt.Errorf("%s: failed to unlink: %+v", fpath, err)
		}
	}

	err = os.Symlink(target, fpath)
	if err != nil {
		return fmt.Errorf("%s: making symbolic link for: %v", fpath, err)
	}
	return nil
}

func writeNewHardLink(fpath string, target string) error {
	err := os.MkdirAll(filepath.Dir(fpath), 0755)
	if err != nil {
		return xerrors.Errorf("%s: making directory for file: %v", fpath, err)
	}

	_, err = os.Lstat(fpath)
	if err == nil {
		err = os.Remove(fpath)
		if err != nil {
			return xerrors.Errorf("%s: failed to unlink: %+v", fpath, err)
		}
	}

	err = os.Link(target, fpath)
	if err != nil {
		return xerrors.Errorf("%s: making hard link for: %v", fpath, err)
	}

	return nil
}
