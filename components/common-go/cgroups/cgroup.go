// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cgroups

import (
	"github.com/containerd/cgroups"
	v2 "github.com/containerd/cgroups/v2"
)

func IsUnifiedCgroupSetup() (bool, error) {
	return cgroups.Mode() == cgroups.Unified, nil
}

func EnsureCpuControllerEnabled(basePath, cgroupPath string) error {
	c, err := v2.NewManager(basePath, cgroupPath, &v2.Resources{})
	if err != nil {
		return err
	}

	err = c.ToggleControllers([]string{"cpu"}, v2.Enable)
	if err != nil {
		return err
	}

	return nil
}
