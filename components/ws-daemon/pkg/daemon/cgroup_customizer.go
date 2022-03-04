// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package daemon

import (
	"context"

	"github.com/containerd/cgroups"
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
		return xerrors.Errorf("cannot start governer: %w", err)
	}

	control, err := cgroups.Load(c.customV1, cgroups.StaticPath(cgroupPath))

	if err != nil {
		return xerrors.Errorf("error loading cgroup at path: %s %w", cgroupPath, err)
	}

	res := &specs.LinuxResources{
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
	}

	if err := control.Update(res); err != nil {
		return xerrors.Errorf("cgroup update failed: %w", err)
	}

	return nil
}

func (c *CgroupCustomizer) customV1() ([]cgroups.Subsystem, error) {
	return []cgroups.Subsystem{
		cgroups.NewDevices(c.cgroupBasePath),
	}, nil
}
