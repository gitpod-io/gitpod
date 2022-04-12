// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cpulimit

import (
	"bufio"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/xerrors"
)

type CgroupV2CFSController string

func (basePath CgroupV2CFSController) Usage() (CPUTime, error) {
	usage, err := basePath.getFlatKeyedValue("usage_usec")
	if err != nil {
		return 0, err
	}

	// 🤮 Total utter uggly hack that must never see the light of day
	err = basePath.writeIOMax()
	if err != nil {
		log.WithError(err).Warn("cannot write io.max")
	}

	return CPUTime(time.Duration(usage) * time.Microsecond), nil
}

func (basePath CgroupV2CFSController) SetLimit(limit Bandwidth) (changed bool, err error) {
	quota, period, err := basePath.readCpuMax()
	if err != nil {
		return false, xerrors.Errorf("failed to read cpu max from %s: %w", basePath, err)
	}

	target := limit.Quota(period)
	if quota == target {
		return false, nil
	}

	err = basePath.writeQuota(target)
	if err != nil {
		return false, xerrors.Errorf("cannot set CFS quota of %d (period is %d, parent quota is %d): %w",
			target.Microseconds(), period.Microseconds(), basePath.readParentQuota().Microseconds(), err)
	}

	return true, nil
}

func (basePath CgroupV2CFSController) NrThrottled() (uint64, error) {
	throttled, err := basePath.getFlatKeyedValue("nr_throttled")
	if err != nil {
		return 0, err
	}

	return uint64(throttled), nil
}

func (basePath CgroupV2CFSController) readCpuMax() (time.Duration, time.Duration, error) {
	cpuMaxPath := filepath.Join(string(basePath), "cpu.max")
	cpuMax, err := os.ReadFile(cpuMaxPath)
	if err != nil {
		return 0, 0, xerrors.Errorf("unable to read cpu.max: %w", err)
	}

	parts := strings.Fields(string(cpuMax))
	if len(parts) < 2 {
		return 0, 0, xerrors.Errorf("cpu.max did not have expected number of fields: %s", parts)
	}

	var quota int64
	if parts[0] == "max" {
		quota = math.MaxInt64
	} else {
		quota, err = strconv.ParseInt(parts[0], 10, 64)
		if err != nil {
			return 0, 0, xerrors.Errorf("could not parse quota of %s: %w", parts[0], err)
		}
	}

	period, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return 0, 0, xerrors.Errorf("could not parse period of %s: %w", parts[1], err)
	}

	return time.Duration(quota) * time.Microsecond, time.Duration(period) * time.Microsecond, nil
}

func (basePath CgroupV2CFSController) writeQuota(quota time.Duration) error {
	cpuMaxPath := filepath.Join(string(basePath), "cpu.max")
	return os.WriteFile(cpuMaxPath, []byte(strconv.FormatInt(quota.Microseconds(), 10)), 0644)
}

func (basePath CgroupV2CFSController) writeIOMax() error {
	const (
		wbps  = 100 * 1024 * 1024
		rbps  = 100 * 1024 * 1024
		riops = 100
		wiops = 150
	)

	iostat, err := os.ReadFile(filepath.Join(string(basePath), "io.stat"))
	if err != nil {
		return err
	}
	var devs []string
	for _, line := range strings.Split(string(iostat), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 1 {
			continue
		}
		devs = append(devs, fields[0])
	}

	cpuMaxPath := filepath.Join(string(basePath), "io.max")
	for _, dev := range devs {
		err := os.WriteFile(cpuMaxPath, []byte(fmt.Sprintf("%s wbps=%d rbps=%d wiops=%d riops=%d", dev, wbps, rbps, wiops, riops)), 0644)
		if err != nil {
			log.WithField("dev", dev).WithError(err).Warn("cannot write io.max")
		}
	}
	return nil
}

func (basePath CgroupV2CFSController) readParentQuota() time.Duration {
	parent := CgroupV2CFSController(filepath.Dir(string(basePath)))
	quota, _, err := parent.readCpuMax()
	if err != nil {
		return time.Duration(0)
	}

	return time.Duration(quota)
}

func (basePath CgroupV2CFSController) getFlatKeyedValue(key string) (int64, error) {
	stats, err := os.Open(filepath.Join(string(basePath), "cpu.stat"))
	if err != nil {
		return 0, xerrors.Errorf("cannot read cpu.stat: %w", err)
	}
	defer stats.Close()

	scanner := bufio.NewScanner(stats)
	for scanner.Scan() {
		entry := scanner.Text()
		if !strings.HasPrefix(entry, key) {
			continue
		}

		r, err := strconv.ParseInt(strings.TrimSpace(strings.TrimPrefix(entry, key)), 10, 64)
		if err != nil {
			return 0, xerrors.Errorf("cannot parse cpu.stat: %s: %w", entry, err)
		}
		return int64(r), nil
	}
	return 0, xerrors.Errorf("cpu.stat did not contain nr_throttled")
}
