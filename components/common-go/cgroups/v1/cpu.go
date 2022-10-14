// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cgroups_v1

import (
	"path/filepath"

	"github.com/gitpod-io/gitpod/common-go/cgroups"
)

type Cpu struct {
	path string
}

func NewCpuControllerWithMount(mountPoint, path string) *Cpu {
	fullPath := filepath.Join(mountPoint, "cpu", path)
	return &Cpu{
		path: fullPath,
	}
}

func NewCpuController(path string) *Cpu {
	path = filepath.Join(cgroups.DefaultMountPoint, "cpu", path)
	return &Cpu{
		path: path,
	}
}

// Quota returns the cpu quota in microseconds
func (c *Cpu) Quota() (uint64, error) {
	path := filepath.Join(c.path, "cpu.cfs_quota_us")
	return cgroups.ReadSingleValue(path)
}

// Period returns the cpu period in microseconds
func (c *Cpu) Period() (uint64, error) {
	path := filepath.Join(c.path, "cpu.cfs_period_us")
	return cgroups.ReadSingleValue(path)
}

// Usage returns the cpu usage in nanoseconds
func (c *Cpu) Usage() (uint64, error) {
	path := filepath.Join(c.path, "cpuacct.usage")
	return cgroups.ReadSingleValue(path)
}
