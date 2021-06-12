// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package initializer

import (
	"context"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"
)

type FileInfo struct {
	url string
	// filePath is relative to the FileDownloadInitializer's TargetLocation, e.g. if TargetLocation is in `/workspace/myrepo`
	// a filePath of `foobar/file` would produce a file in `/workspace/myrepo/foobar/file`.
	// filePath must include the filename. The FileDownloadInitializer will create any parent directories
	// necessary to place the file.
	filePath string
	// digest is a hash of the file content in the OCI digest format (see https://github.com/opencontainers/image-spec/blob/master/descriptor.md#digests).
	// This information is used to compute subsequent
	// content versions, and to validate the file content was downloaded correctly.
	digest string
}

type FileDownloadInitializer struct {
	FilesInfos     []FileInfo
	TargetLocation string
}

// Run initializes the workspace
func (ws *FileDownloadInitializer) Run(ctx context.Context, mappings []archive.IDMapping) (src csapi.WorkspaceInitSource, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "FileDownloadInitializer.Run")
	defer tracing.FinishSpan(span, &err)

	for _, info := range ws.FilesInfos {
		contents, err := downloadFile(ctx, info.url)
		if err != nil {
			tracing.LogError(span, xerrors.Errorf("cannot download file '%s' from '%s': %w", info.filePath, info.url, err))
		}

		fullPath := filepath.Join(ws.TargetLocation, info.filePath)
		err = os.MkdirAll(filepath.Dir(fullPath), 0755)
		if err != nil {
			tracing.LogError(span, xerrors.Errorf("cannot mkdir %s: %w", filepath.Dir(fullPath), err))
		}
		err = ioutil.WriteFile(fullPath, contents, 0755)
		if err != nil {
			tracing.LogError(span, xerrors.Errorf("cannot write %s: %w", fullPath, err))
		}
	}
	return src, nil
}

func downloadFile(ctx context.Context, url string) (content []byte, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "downloadFile")
	defer tracing.FinishSpan(span, &err)
	span.LogKV("url", url)

	dl := func() (content []byte, err error) {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return nil, err
		}
		_ = opentracing.GlobalTracer().Inject(span.Context(), opentracing.HTTPHeaders, opentracing.HTTPHeadersCarrier(req.Header))

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return nil, xerrors.Errorf("non-OK OTS response: %s", resp.Status)
		}

		return io.ReadAll(resp.Body)
	}
	for i := 0; i < otsDownloadAttempts; i++ {
		span.LogKV("attempt", i)
		if i > 0 {
			time.Sleep(time.Second)
		}

		content, err = dl()
		if err == context.Canceled || err == context.DeadlineExceeded {
			return
		}
		if err == nil {
			break
		}
		log.WithError(err).WithField("attempt", i).Warn("cannot download additional content files")
	}
	if err != nil {
		return nil, err
	}

	return content, nil
}
