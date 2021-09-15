// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package initializer

import (
	"context"
	"os"
	"path/filepath"

	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"
)

type file struct {
	Content string

	// Path is relative to the FileDownloadInitializer's TargetLocation, e.g. if TargetLocation is in `/workspace/myrepo`
	// a Path of `foobar/file` would produce a file in `/workspace/myrepo/foobar/file`.
	// Path must include the filename. The FileDownloadInitializer will create any parent directories
	// necessary to place the file.
	Path string
}

type filesInitializer struct {
	Files          []file
	TargetLocation string
}

// Run initializes the workspace
func (ws *filesInitializer) Run(ctx context.Context, mappings []archive.IDMapping) (src csapi.WorkspaceInitSource, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "FilesInitializer.Run")
	defer tracing.FinishSpan(span, &err)

	for _, f := range ws.Files {
		ws.writeFile(ctx, f)
		if err != nil {
			tracing.LogError(span, xerrors.Errorf("error writing file content to %s: %w", f.Path, err))
			return src, err
		}
	}
	return csapi.WorkspaceInitFromOther, nil
}

func (ws *filesInitializer) writeFile(ctx context.Context, f file) (err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "FilesInitializer.writeFile")
	defer tracing.FinishSpan(span, &err)

	fn := filepath.Join(ws.TargetLocation, f.Path)
	err = os.MkdirAll(filepath.Dir(fn), 0755)
	if err != nil {
		tracing.LogError(span, xerrors.Errorf("cannot mkdir %s: %w", filepath.Dir(fn), err))
	}

	fd, err := os.OpenFile(fn, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}

	_, err = fd.WriteString(f.Content)
	return err
}
