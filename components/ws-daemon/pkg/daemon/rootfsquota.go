// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package daemon

import (
	"context"
	"os"
	"path/filepath"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/content"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/quota"
	"golang.org/x/xerrors"
	"k8s.io/apimachinery/pkg/util/wait"
)

type ContainerRootFSQuotaEnforcer struct {
	Quota       quota.Size
	WorkingArea string
}

func (c *ContainerRootFSQuotaEnforcer) WorkspaceAdded(ctx context.Context, ws *dispatch.Workspace) error {
	disp := dispatch.GetFromContext(ctx)
	if disp == nil {
		return xerrors.Errorf("no dispatch available")
	}

	loc := filepath.Join(c.WorkingArea, content.ServiceDirName(ws.InstanceID), "mark")
	err := wait.Poll(5*time.Second, 1*time.Minute, func() (bool, error) {
		return directoryExists(loc), nil
	})
	if err != nil {
		return xerrors.Errorf("cannot create workspace quota in location %v: %w", loc, err)
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

	log.WithField("location", loc).WithField("quota", c.Quota).Info("workspace root FS quota")

	return nil
}

func directoryExists(filename string) bool {
	info, err := os.Stat(filename)
	if os.IsNotExist(err) {
		return false
	}

	return info.IsDir()
}
