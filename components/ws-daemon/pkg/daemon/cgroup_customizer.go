// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package daemon

import (
	"context"
	"path/filepath"

	"github.com/containerd/cgroups"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/container"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/dispatch"
	"github.com/opencontainers/runc/libcontainer/cgroups/ebpf"
	"github.com/opencontainers/runc/libcontainer/cgroups/ebpf/devicefilter"
	"github.com/opencontainers/runc/libcontainer/devices"
	"github.com/opencontainers/runc/libcontainer/specconv"
	"github.com/opencontainers/runtime-spec/specs-go"
	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"
)

var (
	fuseDeviceMajor int64 = 10
	fuseDeviceMinor int64 = 229
)

func NewCGroupCustomizer(basePath string, unified bool) dispatch.Listener {
	if unified {
		return &CgroupCustomizerV2{
			cgroupBasePath: basePath,
		}
	} else {
		return &CgroupCustomizerV1{
			cgroupBasePath: basePath,
		}
	}
}

type CgroupCustomizerV1 struct {
	cgroupBasePath string
}

func (c *CgroupCustomizerV1) WithCgroupBasePath(basePath string) {
	c.cgroupBasePath = basePath
}

// WorkspaceAdded will customize the cgroups for every workspace that is started
func (c *CgroupCustomizerV1) WorkspaceAdded(ctx context.Context, ws *dispatch.Workspace) error {
	cgroupPath, err := retrieveCGroupPath(ctx, ws.ContainerID)
	if err != nil {
		return err
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

func (c *CgroupCustomizerV1) customV1() ([]cgroups.Subsystem, error) {
	return []cgroups.Subsystem{
		cgroups.NewDevices(c.cgroupBasePath),
	}, nil
}

type CgroupCustomizerV2 struct {
	cgroupBasePath string
}

func (c *CgroupCustomizerV2) WorkspaceAdded(ctx context.Context, ws *dispatch.Workspace) error {
	cgroupPath, err := retrieveCGroupPath(ctx, ws.ContainerID)
	if err != nil {
		return err
	}

	fullCgroupPath := filepath.Join(c.cgroupBasePath, cgroupPath)
	cgroupFD, err := unix.Open(fullCgroupPath, unix.O_DIRECTORY|unix.O_RDONLY, 0o600)
	if err != nil {
		return xerrors.Errorf("cannot get directory fd for %s", fullCgroupPath)
	}
	defer unix.Close(cgroupFD)

	insts, license, err := devicefilter.DeviceFilter(composeDeviceRules())
	if err != nil {
		return xerrors.Errorf("failed to generate device filter: %w", err)
	}

	_, err = ebpf.LoadAttachCgroupDeviceFilter(insts, license, cgroupFD)
	return err
}

func retrieveCGroupPath(ctx context.Context, id container.ID) (string, error) {
	disp := dispatch.GetFromContext(ctx)
	if disp == nil {
		return "", xerrors.Errorf("no dispatch available")
	}

	cgroupPath, err := disp.Runtime.ContainerCGroupPath(context.Background(), id)
	if err != nil {
		return "", xerrors.Errorf("cannot retrieve cgroup path: %w", err)
	}

	return cgroupPath, nil
}

func composeDeviceRules() []*devices.Rule {
	denyAll := devices.Rule{
		Type:        'a',
		Permissions: "rwm",
		Allow:       false,
	}

	allowFuse := devices.Rule{
		Type:        'c',
		Major:       fuseDeviceMajor,
		Minor:       fuseDeviceMinor,
		Permissions: "rwm",
		Allow:       true,
	}

	deviceRules := make([]*devices.Rule, 0)
	deviceRules = append(deviceRules, &denyAll, &allowFuse)
	for _, device := range specconv.AllowedDevices {
		deviceRules = append(deviceRules, &device.Rule)
	}

	return deviceRules
}
