// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package content

import (
	"archive/tar"
	"context"
	"io"
	"os"

	"github.com/docker/docker/pkg/archive"
	"github.com/docker/docker/pkg/idtools"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/tracing"
	carchive "github.com/gitpod-io/gitpod/content-service/pkg/archive"
)

// ConvertWhiteout converts whiteout files from the archive
type ConvertWhiteout func(*tar.Header, string) (bool, error)

// BuildTarbal creates an OCI compatible tar file dst from the folder src, expecting the overlay whiteout format
func BuildTarbal(ctx context.Context, src string, dst string, fullWorkspaceBackup bool, opts ...carchive.TarOption) (err error) {
	var cfg carchive.TarConfig
	for _, opt := range opts {
		opt(&cfg)
	}

	//nolint:staticcheck,ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "buildTarbal")
	span.LogKV("src", src, "dst", dst)
	defer tracing.FinishSpan(span, &err)

	// ensure the src actually exists before trying to tar it
	if _, err := os.Stat(src); err != nil {
		return xerrors.Errorf("Unable to tar files: %v", err.Error())
	}

	uidMaps := make([]idtools.IDMap, len(cfg.UIDMaps))
	for i, m := range cfg.UIDMaps {
		uidMaps[i] = idtools.IDMap{
			ContainerID: m.ContainerID,
			HostID:      m.HostID,
			Size:        m.Size,
		}
	}
	gidMaps := make([]idtools.IDMap, len(cfg.GIDMaps))
	for i, m := range cfg.GIDMaps {
		gidMaps[i] = idtools.IDMap{
			ContainerID: m.ContainerID,
			HostID:      m.HostID,
			Size:        m.Size,
		}
	}

	var tarout io.ReadCloser
	if fullWorkspaceBackup {
		tarout, err = archive.TarWithOptions(src, &archive.TarOptions{
			UIDMaps:        uidMaps,
			GIDMaps:        gidMaps,
			InUserNS:       true,
			WhiteoutFormat: archive.OverlayWhiteoutFormat,
		})
	} else {
		tarout, err = TarWithOptions(src, &TarOptions{
			UIDMaps: uidMaps,
			GIDMaps: gidMaps,
		})
	}

	if err != nil {
		return xerrors.Errorf("cannot create tar: %w", err)
	}

	fout, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE, 0744)
	if err != nil {
		return cleanCorruptedTarballAndReturnError(dst, xerrors.Errorf("cannot open archive for writing: %w", err))
	}

	defer fout.Close()

	targetOut := newLimitWriter(fout, cfg.MaxSizeBytes)
	defer func(e *error) {
		if targetOut.DidMaxOut() {
			*e = ErrMaxSizeExceeded
		}
	}(&err)

	_, err = io.Copy(targetOut, tarout)
	if err != nil {
		return cleanCorruptedTarballAndReturnError(dst, xerrors.Errorf("cannot write tar file: %w", err))
	}
	if err = fout.Sync(); err != nil {
		return cleanCorruptedTarballAndReturnError(dst, xerrors.Errorf("cannot flush tar out stream: %w", err))
	}

	return nil
}

// ErrMaxSizeExceeded is emitted by LimitWriter when a write tries to write beyond the max number of bytes allowed
var ErrMaxSizeExceeded = xerrors.Errorf("maximum size exceeded")

// cleanCorruptedTarballAndReturnError cleans up the file located at path dst and returns the error err passed to it
func cleanCorruptedTarballAndReturnError(dst string, err error) error {
	os.Remove(dst)
	return err
}

// newLimitWriter wraps a writer such that a maximum of N bytes can be written. Once that limit is exceeded
// the writer returns io.ErrClosedPipe
func newLimitWriter(out io.Writer, maxSizeBytes int64) *limitWriter {
	return &limitWriter{
		MaxSizeBytes: maxSizeBytes,
		Out:          out,
	}
}

type limitWriter struct {
	MaxSizeBytes int64
	Out          io.Writer
	BytesWritten int64

	didMaxOut bool
}

func (s *limitWriter) Write(b []byte) (n int, err error) {
	if s.MaxSizeBytes == 0 {
		return s.Out.Write(b)
	}

	bsize := int64(len(b))
	if bsize+s.BytesWritten > s.MaxSizeBytes {
		s.didMaxOut = true
		return 0, ErrMaxSizeExceeded
	}

	n, err = s.Out.Write(b)
	s.BytesWritten += int64(n)

	return n, err
}

func (s *limitWriter) DidMaxOut() bool {
	return s.didMaxOut
}
