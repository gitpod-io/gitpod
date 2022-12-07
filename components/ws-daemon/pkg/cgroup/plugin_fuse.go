// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cgroup

import (
	"context"

	"github.com/containerd/cgroups"
	"github.com/opencontainers/runtime-spec/specs-go"
	"golang.org/x/xerrors"
)

var (
	fuseDeviceMajor int64 = 10
	fuseDeviceMinor int64 = 229
)

type FuseDeviceEnablerV1 struct{}

func (c *FuseDeviceEnablerV1) Name() string  { return "fuse-device-enabler-v1" }
func (c *FuseDeviceEnablerV1) Type() Version { return Version1 }

func (c *FuseDeviceEnablerV1) Apply(ctx context.Context, opts *PluginOptions) error {
	control, err := cgroups.Load(customV1(opts.BasePath), cgroups.StaticPath(opts.CgroupPath))

	if err != nil {
		return xerrors.Errorf("error loading cgroup at path: %s %w", opts.CgroupPath, err)
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

func customV1(basePath string) func() ([]cgroups.Subsystem, error) {
	return func() ([]cgroups.Subsystem, error) {
		return []cgroups.Subsystem{
			cgroups.NewDevices(basePath),
		}, nil
	}
}
