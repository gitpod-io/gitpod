// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cgroups

import (
	"math"
	"os"
	"strconv"
	"strings"

	"github.com/containerd/cgroups"
	v2 "github.com/containerd/cgroups/v2"
)

const DefaultMountPoint = "/sys/fs/cgroup"

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

type CpuStats struct {
	UsageTotal  uint64
	UsageUser   uint64
	UsageSystem uint64
}

type MemoryStats struct {
	InactiveFileTotal uint64
}

func ReadSingleValue(path string) (uint64, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}

	value := strings.TrimSpace(string(content))
	if value == "max" || value == "-1" {
		return math.MaxUint64, nil
	}

	max, err := strconv.ParseUint(value, 10, 64)
	if err != nil {
		return 0, err
	}

	return max, nil
}

func ReadFlatKeyedFile(path string) (map[string]uint64, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	entries := strings.Split(strings.TrimSpace(string(content)), "\n")
	kv := make(map[string]uint64, len(entries))
	for _, entry := range entries {
		tokens := strings.Split(entry, " ")
		if len(tokens) < 2 {
			continue
		}
		v, err := strconv.ParseUint(tokens[1], 10, 64)
		if err != nil {
			continue
		}
		kv[tokens[0]] = v
	}

	return kv, nil
}
