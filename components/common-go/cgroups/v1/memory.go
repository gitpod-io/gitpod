// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cgroups_v1

import (
	"path/filepath"

	"github.com/gitpod-io/gitpod/common-go/cgroups"
)

type Memory struct {
	path string
}

func NewMemoryControllerWithMount(mountPoint, path string) *Memory {
	fullPath := filepath.Join(mountPoint, "memory", path)
	return &Memory{
		path: fullPath,
	}
}

func NewMemoryController(path string) *Memory {
	path = filepath.Join(cgroups.DefaultMountPoint, "memory", path)
	return &Memory{
		path: path,
	}
}

// Limit returns the memory limit in bytes
func (m *Memory) Limit() (uint64, error) {
	path := filepath.Join(m.path, "memory.limit_in_bytes")
	return cgroups.ReadSingleValue(path)
}

// Usage returns the memory usage in bytes
func (m *Memory) Usage() (uint64, error) {
	path := filepath.Join(m.path, "memory.usage_in_bytes")
	return cgroups.ReadSingleValue(path)
}

// Stat returns cpu statistics
func (m *Memory) Stat() (*cgroups.MemoryStats, error) {
	path := filepath.Join(m.path, "memory.stat")
	statMap, err := cgroups.ReadFlatKeyedFile(path)
	if err != nil {
		return nil, err
	}

	return &cgroups.MemoryStats{
		InactiveFileTotal: statMap["total_inactive_file"],
	}, nil
}
