// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package initializer

import (
	"context"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"github.com/opencontainers/go-digest"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/sync/errgroup"
	"golang.org/x/xerrors"
)

type fileInfo struct {
	URL string

	// Path is relative to the FileDownloadInitializer's TargetLocation, e.g. if TargetLocation is in `/workspace/myrepo`
	// a Path of `foobar/file` would produce a file in `/workspace/myrepo/foobar/file`.
	// Path must include the filename. The FileDownloadInitializer will create any parent directories
	// necessary to place the file.
	Path string

	// Digest is a hash of the file content in the OCI Digest format (see https://github.com/opencontainers/image-spec/blob/master/descriptor.md#digests).
	// This information is used to compute subsequent
	// content versions, and to validate the file content was downloaded correctly.
	Digest digest.Digest
}

type fileDownloadInitializer struct {
	FilesInfos     []fileInfo
	TargetLocation string
	HTTPClient     *http.Client
	RetryTimeout   time.Duration
}

// Run initializes the workspace
func (ws *fileDownloadInitializer) Run(ctx context.Context, mappings []archive.IDMapping) (src csapi.WorkspaceInitSource, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "FileDownloadInitializer.Run")
	defer tracing.FinishSpan(span, &err)

	for _, info := range ws.FilesInfos {
		err := ws.downloadFile(ctx, info)
		if err != nil {
			tracing.LogError(span, xerrors.Errorf("cannot download file '%s' from '%s': %w", info.Path, info.URL, err))
			return src, err
		}
	}
	return csapi.WorkspaceInitFromOther, nil
}

func (ws *fileDownloadInitializer) downloadFile(ctx context.Context, info fileInfo) (err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "downloadFile")
	defer tracing.FinishSpan(span, &err)
	span.LogKV("url", info.URL)

	fn := filepath.Join(ws.TargetLocation, info.Path)
	err = os.MkdirAll(filepath.Dir(fn), 0755)
	if err != nil {
		tracing.LogError(span, xerrors.Errorf("cannot mkdir %s: %w", filepath.Dir(fn), err))
	}

	fd, err := os.OpenFile(fn, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}

	dl := func() (err error) {
		req, err := http.NewRequestWithContext(ctx, "GET", info.URL, nil)
		if err != nil {
			return err
		}
		_ = opentracing.GlobalTracer().Inject(span.Context(), opentracing.HTTPHeaders, opentracing.HTTPHeadersCarrier(req.Header))

		resp, err := ws.HTTPClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return xerrors.Errorf("non-OK download response: %s", resp.Status)
		}

		pr, pw := io.Pipe()
		body := io.TeeReader(resp.Body, pw)

		eg, _ := errgroup.WithContext(ctx)
		eg.Go(func() error {
			_, err = io.Copy(fd, body)
			pw.Close()
			return err
		})
		eg.Go(func() error {
			dgst, err := digest.FromReader(pr)
			if err != nil {
				return err
			}
			if dgst != info.Digest {
				return xerrors.Errorf("digest mismatch")
			}
			return nil
		})

		return eg.Wait()
	}
	for i := 0; i < otsDownloadAttempts; i++ {
		span.LogKV("attempt", i)
		if i > 0 {
			time.Sleep(ws.RetryTimeout)
		}

		err = dl()
		if err == context.Canceled || err == context.DeadlineExceeded {
			return
		}
		if err == nil {
			break
		}
		log.WithError(err).WithField("attempt", i).Warn("cannot download additional content files")
	}
	if err != nil {
		return err
	}

	return nil
}
