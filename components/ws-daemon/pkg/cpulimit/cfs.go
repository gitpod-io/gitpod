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
	cputime, err := basePath.readCpuUsage()
	if err != nil {
		return 0, xerrors.Errorf("cannot read cpuacct.usage: %w", err)
	}

	return CPUTime(cputime), nil
}

// SetQuota sets a new CFS quota on the cgroup
func (basePath CgroupCFSController) SetLimit(limit Bandwidth) (changed bool, err error) {
	period, err := basePath.readCfsPeriod()
	if err != nil {
		err = xerrors.Errorf("cannot parse CFS period: %w", err)
		return
	}

	quota, err := basePath.readCfsQuota()
	if err != nil {
		err = xerrors.Errorf("cannot parse CFS quota: %w", err)
		return
	}
	target := limit.Quota(period)
	if quota == target {
		return false, nil
	}

	err = os.WriteFile(filepath.Join(string(basePath), "cpu.cfs_quota_us"), []byte(strconv.FormatInt(target.Microseconds(), 10)), 0644)
	if err != nil {
		return false, xerrors.Errorf("cannot set CFS quota of %d (period is %d, parent quota is %d): %w",
			target.Microseconds(), period.Microseconds(), basePath.readParentQuota().Microseconds(), err)
	}
	return true, nil
}

func (basePath CgroupCFSController) readParentQuota() time.Duration {
	parent := CgroupCFSController(filepath.Dir(string(basePath)))
	pq, err := parent.readCfsQuota()
	if err != nil {
		return time.Duration(0)
	}

	return time.Duration(pq) * time.Microsecond
}

func (basePath CgroupCFSController) readString(path string) (string, error) {
	fn := filepath.Join(string(basePath), path)
	fc, err := os.ReadFile(fn)
	if err != nil {
		return "", err
	}

	s := strings.TrimSpace(string(fc))
	return s, nil
}

func (basePath CgroupCFSController) readCfsPeriod() (time.Duration, error) {
	s, err := basePath.readString("cpu.cfs_period_us")
	if err != nil {
		return 0, err
	}

	p, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0, err
	}
	return time.Duration(uint64(p)) * time.Microsecond, nil
}

func (basePath CgroupCFSController) readCfsQuota() (time.Duration, error) {
	s, err := basePath.readString("cpu.cfs_quota_us")
	if err != nil {
		return 0, err
	}

	p, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0, err
	}

	if p < 0 {
		return time.Duration(math.MaxInt64), nil
	}
	return time.Duration(p) * time.Microsecond, nil
}

func (basePath CgroupCFSController) readCpuUsage() (time.Duration, error) {
	s, err := basePath.readString("cpuacct.usage")
	if err != nil {
		return 0, err
	}

	p, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0, err
	}
	return time.Duration(uint64(p)) * time.Nanosecond, nil
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
