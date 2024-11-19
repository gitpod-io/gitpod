// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package content

import (
	"context"
	"io"
	"os"

	"github.com/containers/storage/pkg/archive"
	"github.com/containers/storage/pkg/idtools"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/tracing"
	carchive "github.com/gitpod-io/gitpod/content-service/pkg/archive"
)

// BuildTarbal creates an OCI compatible tar file dst from the folder src, expecting the overlay whiteout format
func BuildTarbal(ctx context.Context, src string, dst string, opts ...carchive.TarOption) (err error) {
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

	tarReader, err := archive.TarWithOptions(src, &archive.TarOptions{
		UIDMaps:     uidMaps,
		GIDMaps:     gidMaps,
		Compression: archive.Uncompressed,
		CopyPass:    true,
	})
	if err != nil {
		return
	}
	defer tarReader.Close()

	tarFile, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY, 0755)
	if err != nil {
		return xerrors.Errorf("Unable to create tar file: %v", err.Error())
	}

	_, err = io.Copy(tarFile, tarReader)
	if err != nil {
		return xerrors.Errorf("Unable create tar file: %v", err.Error())
	}

	return
}
