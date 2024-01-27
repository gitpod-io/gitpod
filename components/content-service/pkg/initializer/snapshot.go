// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package initializer

import (
	"context"
	"time"

	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/archive"
	"github.com/gitpod-io/gitpod/content-service/pkg/storage"
)

// SnapshotInitializer downloads a snapshot from a remote storage
type SnapshotInitializer struct {
	Location           string
	Snapshot           string
	Storage            storage.DirectDownloader
	FromVolumeSnapshot bool
}

// Run downloads a snapshot from a remote storage
func (s *SnapshotInitializer) Run(ctx context.Context, mappings []archive.IDMapping) (src csapi.WorkspaceInitSource, stats csapi.InitializerMetrics, err error) {
	//nolint:ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "SnapshotInitializer")
	span.SetTag("snapshot", s.Snapshot)
	defer tracing.FinishSpan(span, &err)
	start := time.Now()
	initialSize, fsErr := getFsUsage()
	if fsErr != nil {
		log.WithError(fsErr).Error("could not get disk usage")
	}

	src = csapi.WorkspaceInitFromBackup

	if s.FromVolumeSnapshot {
		log.Info("SnapshotInitializer detected volume snapshot, skipping")
		return src, nil, nil
	}

	ok, err := s.Storage.DownloadSnapshot(ctx, s.Location, s.Snapshot, mappings)
	if err != nil {
		return src, nil, xerrors.Errorf("snapshot initializer: %w", err)
	}
	if !ok {
		return src, nil, xerrors.Errorf("did not find snapshot %s", s.Snapshot)
	}

	if fsErr == nil {
		currentSize, fsErr := getFsUsage()
		if fsErr != nil {
			log.WithError(fsErr).Error("could not get disk usage")
		}

		stats = csapi.InitializerMetrics{csapi.InitializerMetric{
			Type:     "snapshot",
			Duration: time.Since(start),
			Size:     currentSize - initialSize,
		}}
	}

	return
}
