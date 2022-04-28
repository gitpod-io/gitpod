// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package archive

import (
	"context"
	"io"
	"time"

	"github.com/containers/storage/pkg/archive"
	"github.com/containers/storage/pkg/idtools"
	"github.com/opentracing/opentracing-go"

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
	//nolint:staticcheck,ineffassign
	span, ctx := opentracing.StartSpanFromContext(ctx, "extractTarbal")
	span.LogKV("dst", dst)
	defer tracing.FinishSpan(span, &err)

	var cfg TarConfig
	start := time.Now()
	for _, opt := range opts {
		opt(&cfg)
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

	err = archive.Untar(src, dst, &archive.TarOptions{
		UIDMaps:     uidMaps,
		GIDMaps:     gidMaps,
		Compression: archive.Uncompressed,
	})

	log.WithField("duration", time.Since(start).Milliseconds()).Debug("untar complete")
	return
}
