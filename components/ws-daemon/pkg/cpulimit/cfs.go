// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cpulimit

import (
	"bufio"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"golang.org/x/xerrors"
)

// CgroupCFSController controls a cgroup's CFS settings
type CgroupCFSController string

// Usage returns the cpuacct.usage value of the cgroup
func (basePath CgroupCFSController) Usage() (usage CPUTime, err error) {

	cpuTimeInNS, err := basePath.readUint64("cpuacct.usage")
	if err != nil {
		return 0, xerrors.Errorf("cannot read cpuacct.usage: %w", err)
	}

	return CPUTime(time.Duration(cpuTimeInNS) * time.Nanosecond), nil
}

// SetQuota sets a new CFS quota on the cgroup
func (basePath CgroupCFSController) SetLimit(limit Bandwidth) (changed bool, err error) {
	p, err := basePath.readUint64("cpu.cfs_period_us")
	if err != nil {
		err = xerrors.Errorf("cannot parse CFS period: %w", err)
		return
	}
	period := time.Duration(p) * time.Microsecond

	q, err := basePath.readUint64("cpu.cfs_quota_us")
	if err != nil {
		err = xerrors.Errorf("cannot parse CFS quota: %w", err)
		return
	}
	quota := time.Duration(q) * time.Microsecond
	target := limit.Quota(period)
	if quota == target {
		return false, nil
	}

	err = os.WriteFile(filepath.Join(string(basePath), "cpu.cfs_quota_us"), []byte(strconv.FormatInt(target.Microseconds(), 10)), 0644)
	if err != nil {
		return false, xerrors.Errorf("cannot set CFS quota: %w", err)
	}
	return true, nil
}

func (basePath CgroupCFSController) readUint64(path string) (uint64, error) {
	fn := filepath.Join(string(basePath), path)
	fc, err := os.ReadFile(fn)
	if err != nil {
		return 0, err
	}

	s := strings.TrimSpace(string(fc))
	if s == "max" {
		return math.MaxUint64, nil
	}

	p, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0, err
	}
	return uint64(p), nil
}

// NrThrottled returns the number of CFS periods the cgroup was throttled in
func (basePath CgroupCFSController) NrThrottled() (uint64, error) {
	f, err := os.Open(filepath.Join(string(basePath), "cpu.stat"))
	if err != nil {
		return 0, xerrors.Errorf("cannot read cpu.stat: %w", err)
	}
	defer f.Close()

	const prefixNrThrottled = "nr_throttled "

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		l := scanner.Text()
		if !strings.HasPrefix(l, prefixNrThrottled) {
			continue
		}

		r, err := strconv.ParseInt(strings.TrimSpace(strings.TrimPrefix(l, prefixNrThrottled)), 10, 64)
		if err != nil {
			return 0, xerrors.Errorf("cannot parse cpu.stat: %s: %w", l, err)
		}
		return uint64(r), nil
	}
	return 0, xerrors.Errorf("cpu.stat did not contain nr_throttled")
}
