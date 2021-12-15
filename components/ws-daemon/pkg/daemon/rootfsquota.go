// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package daemon

import (
	"context"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/quota"
	"golang.org/x/xerrors"
)

type ContainerRootFSQuotaEnforcer struct {
	Quota quota.Size
}

func (c *ContainerRootFSQuotaEnforcer) WorkspaceAdded(ctx context.Context, ws *dispatch.Workspace) error {
	disp := dispatch.GetFromContext(ctx)
	if disp == nil {
		return xerrors.Errorf("no dispatch available")
	}

	loc, err := disp.Runtime.ContainerRootfs(ctx, ws.ContainerID, container.OptsContainerRootfs{
		Unmapped: false,
		UpperDir: true,
	})
	if err != nil {
		return xerrors.Errorf("cannot find container rootfs: %w", err)
	}

	// TODO(cw); create one FS for all of those operations for performance/memory optimisation
	fs, err := quota.NewXFS(loc)
	if err != nil {
		return xerrors.Errorf("XFS is not supported: %w", err)
	}

	// TODO(cw): we'll need to clean up the used prjquota's - otherwise we'll run out of them on a busy node
	_, err = fs.SetQuota(loc, c.Quota)
	if err != nil {
		return xerrors.Errorf("cannot enforce rootfs quota: %w", err)
	}

	log.WithField("location", loc).WithField("quota", c.Quota).Info("quopta for workspace root FS created")

	return nil
}
