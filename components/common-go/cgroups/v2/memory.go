// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cgroups_v2

import (
	"path/filepath"

	"github.com/gitpod-io/gitpod/common-go/cgroups"
)

type Memory struct {
	path string
}

func NewMemoryControllerWithMount(mountPoint, path string) *Memory {
	fullPath := filepath.Join(mountPoint, path)
	return &Memory{
		path: fullPath,
	}
}

func NewMemoryController(path string) *Memory {
	return &Memory{
		path: path,
	}
}

// Current returns the total amount of memory being used by
// the cgroup and its descendants in bytes.
func (c *Memory) Current() (uint64, error) {
	path := filepath.Join(c.path, "memory.current")
	return cgroups.ReadSingleValue(path)
}

// Max returns the memory usage hard limit in bytes. If the cgroup
// memory usage reaches this limit and cannot be reduced the
// OOM killer will be invoked in the cgroup. If no memory
// restriction has been placed on the cgroup, uint64.max
// will be returned
func (c *Memory) Max() (uint64, error) {
	path := filepath.Join(c.path, "memory.max")
	return cgroups.ReadSingleValue(path)
}

// High returns the memory usage throttle limit in bytes. If the cgroup
// memory usage reaches this limit the processes in the cgroup
// will be put under heavy reclaim pressure.
func (c *Memory) High() (uint64, error) {
	path := filepath.Join(c.path, "memory.high")
	return cgroups.ReadSingleValue(path)
}

func (m *Memory) Stat() (*cgroups.MemoryStats, error) {
	path := filepath.Join(m.path, "memory.stat")
	statMap, err := cgroups.ReadFlatKeyedFile(path)
	if err != nil {
		return nil, err
	}

	return &cgroups.MemoryStats{
		InactiveFileTotal: statMap["inactive_file"],
	}, nil
}

func (m *Memory) PSI() (cgroups.PSI, error) {
	path := filepath.Join(m.path, "memory.pressure")
	return cgroups.ReadPSIValue(path)
}
