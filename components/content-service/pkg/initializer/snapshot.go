// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package initializer

import (
	"context"

	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
)

// SnapshotInitializer downloads a snapshot from a remote storage
type SnapshotInitializer struct {
	Location string
	Snapshot string
	Storage  storage.DirectDownloader
}

// Run downloads a snapshot from a remote storage
func (s *SnapshotInitializer) Run(ctx context.Context, mappings []archive.IDMapping) (src csapi.WorkspaceInitSource, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "SnapshotInitializer")
	span.SetTag("snapshot", s.Snapshot)
	defer tracing.FinishSpan(span, &err)

	src = csapi.WorkspaceInitFromBackup

	ok, err := s.Storage.DownloadSnapshot(ctx, s.Location, s.Snapshot, mappings)
	if err != nil {
		return src, xerrors.Errorf("snapshot initializer: %w", err)
	}
	if !ok {
		return src, xerrors.Errorf("did not find snapshot %s", s.Snapshot)
	}

	return
}
