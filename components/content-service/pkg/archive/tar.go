// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package archive

import (
	"archive/tar"
	"context"
	"io"
	"os"
	"os/exec"
	"path"
	"sort"
	"syscall"
	"time"

	"github.com/moby/moby/pkg/system"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
)

// TarConfig configures tarbal creation/extraction
type TarConfig struct {
	MaxSizeBytes int64
	UIDMaps      []IDMapping
	GIDMaps      []IDMapping
}

// BuildTarbalOption configures the tarbal creation
type TarOption func(o *TarConfig)

// TarbalMaxSize limits the size of a tarbal
func TarbalMaxSize(n int64) TarOption {
	return func(o *TarConfig) {
		o.MaxSizeBytes = n
	}
}

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

	var cfg TarConfig
	start := time.Now()
	for _, opt := range opts {
		opt(&cfg)
	}

	pr, pw := io.Pipe()
	src = io.TeeReader(src, pw)
	tarReader := tar.NewReader(pr)

	type Info struct {
		UID, GID  int
		IsSymlink bool
		Xattrs    map[string]string
	}

	finished := make(chan bool)
	m := make(map[string]Info)

	go func() {
		defer close(finished)
		for {
			hdr, err := tarReader.Next()
			if err == io.EOF {
				finished <- true
				return
			}

			if err != nil {
				log.WithError(err).Error("error reading tar")
				return
			}

			m[hdr.Name] = Info{
				UID:       hdr.Uid,
				GID:       hdr.Gid,
				IsSymlink: (hdr.Linkname != ""),
				//nolint:staticcheck
				Xattrs: hdr.Xattrs,
			}
		}
	}()

	// Be explicit about the tar flags. We want to restore the exact content without changes
	tarcmd := exec.Command(
		"tar",
		"--extract",
		"--preserve-permissions",
		"--xattrs", "--xattrs-include=security.capability",
	)
	tarcmd.Dir = dst
	tarcmd.Stdin = src

	var msg []byte
	msg, err = tarcmd.CombinedOutput()
	if err != nil {
		return xerrors.Errorf("tar %s: %s", dst, err.Error()+";"+string(msg))
	}
	<-finished

	// lets create a sorted list of pathes and chown depth first.
	paths := make([]string, 0, len(m))
	for path := range m {
		paths = append(paths, path)
	}
	sort.Sort(sort.Reverse(sort.StringSlice(paths)))

	// We need to remap the UID and GID between the host and the container to avoid permission issues.
	for _, p := range paths {
		v := m[p]
		uid := toHostID(v.UID, cfg.UIDMaps)
		gid := toHostID(v.GID, cfg.GIDMaps)

		if v.IsSymlink {
			continue
		}

		err = remapFile(path.Join(dst, p), uid, gid, v.Xattrs)
		if err != nil {
			log.WithError(err).WithField("uid", uid).WithField("gid", gid).WithField("path", p).Warn("cannot chown")
		}
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
		if err := system.Lsetxattr(name, key, []byte(value), 0); err != nil {
			log.WithField("name", key).WithField("value", value).WithField("file", name).WithError(err).Error("restoring extended attributes")
			if err == syscall.ENOTSUP || err == syscall.EPERM {
				continue
			}

			return err
		}
	}

	// restore file times
	fileTime := fileInfo.Sys().(*syscall.Stat_t)
	return os.Chtimes(name, timespecToTime(fileTime.Atim), timespecToTime(fileTime.Mtim))
}

func timespecToTime(ts syscall.Timespec) time.Time {
	return time.Unix(int64(ts.Sec), int64(ts.Nsec))
}
