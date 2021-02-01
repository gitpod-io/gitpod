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
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"
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
	var cfg TarConfig
	start := time.Now()
	for _, opt := range opts {
		opt(&cfg)
	}

	//nolint:staticcheck,ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "extractTarbal")
	span.LogKV("src", src, "dst", dst)
	defer tracing.FinishSpan(span, &err)

	pr, pw := io.Pipe()
	src = io.TeeReader(src, pw)
	tarReader := tar.NewReader(pr)
	type Info struct {
		UID, GID int
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
			} else {
				m[hdr.Name] = Info{
					UID: hdr.Uid,
					GID: hdr.Gid,
				}
			}
		}
	}()

	tarcmd := exec.Command("tar", "x")
	tarcmd.Dir = dst
	tarcmd.Stdin = src

	msg, err := tarcmd.CombinedOutput()
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
	for _, p := range paths {
		v := m[p]
		uid := toHostID(v.UID, cfg.UIDMaps)
		gid := toHostID(v.GID, cfg.GIDMaps)
		err = os.Lchown(path.Join(dst, p), uid, gid)
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
