// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package content

import (
	"archive/tar"
	"bufio"
	"context"
	"fmt"
	"io"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
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
		return fmt.Errorf("Unable to tar files: %v", err.Error())
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

	log.Debug("Creating tar file")

	fout, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE, 0744)
	if err != nil {
		return xerrors.Errorf("cannot open archive for writing: %w", err)
	}
	defer fout.Close()
	defer func(e *error) {
		span.LogKV("msg", "Cleanup  on exit", "err", e)
		if e != nil {
			log.WithError(*e).Error("Cleanup on exit went wrong")
			os.Remove(dst)
		} else {
			log.Debug("Cleanup on error was successful")
		}
	}(&err)
	fbout := bufio.NewWriter(fout)
	defer fbout.Flush()

	targetOut := newLimitWriter(fbout, cfg.MaxSizeBytes)
	defer func(e *error) {
		if targetOut.DidMaxOut() {
			*e = ErrMaxSizeExceeded
		}
	}(&err)

	_, err = io.Copy(targetOut, tarout)
	if err != nil {
		return xerrors.Errorf("cannot write tar file: %w", err)
	}
	if err = fbout.Flush(); err != nil {
		return xerrors.Errorf("cannot flush tar out stream: %w", err)
	}

	return nil
}

// ErrMaxSizeExceeded is emitted by LimitWriter when a write tries to write beyond the max number of bytes allowed
var ErrMaxSizeExceeded = fmt.Errorf("maximum size exceeded")

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
