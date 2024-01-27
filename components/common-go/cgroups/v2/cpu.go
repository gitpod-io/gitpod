// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cgroups_v2

import (
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/cgroups"
	"golang.org/x/xerrors"
)

const (
	StatUsageTotal  = "usage_usec"
	StatUsageUser   = "user_usec"
	StatUsageSystem = "system_usec"
)

type Cpu struct {
	path string
}

func NewCpuControllerWithMount(mountPoint, path string) *Cpu {
	fullPath := filepath.Join(mountPoint, path)
	return &Cpu{
		path: fullPath,
	}
}

func NewCpuController(path string) *Cpu {
	return &Cpu{
		path: path,
	}
}

// Max return the quota and period in microseconds
func (c *Cpu) Max() (quota uint64, period uint64, err error) {
	path := filepath.Join(c.path, "cpu.max")
	content, err := os.ReadFile(path)
	if err != nil {
		return 0, 0, err
	}

	values := strings.Split(strings.TrimSpace(string(content)), " ")
	if len(values) < 2 {
		return 0, 0, xerrors.Errorf("%s has less than 2 values", path)
	}

	if values[0] == "max" {
		quota = math.MaxUint64
	} else {
		quota, err = strconv.ParseUint(values[0], 10, 64)
		if err != nil {
			return 0, 0, err
		}
	}

	period, err = strconv.ParseUint(values[1], 10, 64)
	if err != nil {
		return 0, 0, err
	}

	return quota, period, nil
}

// Stat returns cpu statistics (all values are in microseconds)
func (c *Cpu) Stat() (*cgroups.CpuStats, error) {
	path := filepath.Join(c.path, "cpu.stat")
	statMap, err := cgroups.ReadFlatKeyedFile(path)
	if err != nil {
		return nil, err
	}

	stats := cgroups.CpuStats{
		UsageTotal:  statMap[StatUsageTotal],
		UsageUser:   statMap[StatUsageUser],
		UsageSystem: statMap[StatUsageSystem],
	}

	return &stats, nil
}

func (c *Cpu) PSI() (cgroups.PSI, error) {
	path := filepath.Join(c.path, "cpu.pressure")
	return cgroups.ReadPSIValue(path)
}
