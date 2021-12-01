// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package daemon

import (
	"context"
	"time"

	"github.com/containerd/cgroups"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
	"github.com/opencontainers/runtime-spec/specs-go"
	"golang.org/x/xerrors"
)

var (
	fuseDeviceMajor int64 = 10
	fuseDeviceMinor int64 = 229
)

type CgroupCustomizer struct {
	cgroupBasePath string
}

func (c *CgroupCustomizer) WithCgroupBasePath(basePath string) {
	c.cgroupBasePath = basePath
}

// WorkspaceAdded will customize the cgroups for every workspace that is started
func (c *CgroupCustomizer) WorkspaceAdded(ctx context.Context, ws *dispatch.Workspace) error {
	disp := dispatch.GetFromContext(ctx)
	if disp == nil {
		return xerrors.Errorf("no dispatch available")
	}
	cgroupPath, err := disp.Runtime.ContainerCGroupPath(context.Background(), ws.ContainerID)
	if err != nil {
		return xerrors.Errorf("cannot get container (%s) cgroup path: %w", ws.ContainerID, err)
	}

	enableDevFus := func() error {
		control, err := cgroups.Load(c.customV1, cgroups.StaticPath(cgroupPath))
		if err != nil {
			return err
		}

		err = control.Update(&specs.LinuxResources{
			Devices: []specs.LinuxDeviceCgroup{
				// /dev/fuse
				{
					Type:   "c",
					Minor:  &fuseDeviceMinor,
					Major:  &fuseDeviceMajor,
					Access: "rwm",
					Allow:  true,
				},
			},
		})
		if err != nil {
			return err
		}

		return nil
	}

	// We'll try for some time to modify the cgroup. On some systems the cgroup is not fully present
	// by the time this function gets called. A future CRI-based container integration would benefit
	// from containerd internal synchronisation. We don't have that synchronisation today though, hence
	// need to supendously retry.
	go func() {
		t := time.NewTicker(500 * time.Millisecond)
		defer t.Stop()

		for range t.C {
			if ctx.Err() != nil {
				return
			}

			err := enableDevFus()
			if err != nil {
				log.WithField("cgroup", cgroupPath).WithFields(ws.OWI()).WithError(err).Debug("cannot enable /dev/fuse in cgroup")
				continue
			}

			return
		}
	}()

	return nil
}

func (c *CgroupCustomizer) customV1() ([]cgroups.Subsystem, error) {
	return []cgroups.Subsystem{
		cgroups.NewDevices(c.cgroupBasePath),
	}, nil
}
