// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package archive

import (
	"archive/tar"
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/mholt/archiver/v4"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/sys/unix"

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
	type Info struct {
		UID, GID  int
		IsSymlink bool
		Xattrs    map[string]string
	}

	//nolint:staticcheck,ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "extractTarbal")
	span.LogKV("dst", dst)
	defer tracing.FinishSpan(span, &err)

	var cfg TarConfig
	start := time.Now()
	for _, opt := range opts {
		opt(&cfg)
	}

	format := archiver.Tar{}
	handler := func(ctx context.Context, f archiver.File) error {
		header := f.Header.(tar.Header)

		isSymlink := (header.Linkname != "")
		if isSymlink {
			return nil
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
