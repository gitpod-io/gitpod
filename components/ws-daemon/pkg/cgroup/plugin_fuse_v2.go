// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cgroup

import (
	"context"
	"path/filepath"

	"github.com/opencontainers/runc/libcontainer/cgroups/ebpf"
	"github.com/opencontainers/runc/libcontainer/cgroups/ebpf/devicefilter"
	"github.com/opencontainers/runc/libcontainer/devices"
	"github.com/opencontainers/runc/libcontainer/specconv"
	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"
)

type FuseDeviceEnablerV2 struct{}

func (c *FuseDeviceEnablerV2) Name() string  { return "fuse-device-enabler-v2" }
func (c *FuseDeviceEnablerV2) Type() Version { return Version2 }

func (c *FuseDeviceEnablerV2) Apply(ctx context.Context, basePath, cgroupPath string) error {
	fullCgroupPath := filepath.Join(basePath, cgroupPath)
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
	if err != nil {
		return xerrors.Errorf("failed to attach cgroup device filter: %w", err)
	}

	return nil
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
