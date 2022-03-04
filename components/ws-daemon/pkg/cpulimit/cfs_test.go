// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cpulimit

import (
	"math"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/opencontainers/runc/libcontainer/cgroups"
)

func init() {
	cgroups.TestMode = true
}

func createTempDir(t *testing.T, subsystem string) string {
	path := filepath.Join(t.TempDir(), subsystem)
	if err := os.Mkdir(path, 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestCfsSetLimit(t *testing.T) {
	type test struct {
		beforeCfsPeriodUs int
		beforeCfsQuotaUs  int
		bandWidth         Bandwidth
		cfsQuotaUs        int
		changed           bool
	}
	tests := []test{
		{
			beforeCfsPeriodUs: 10000,
			beforeCfsQuotaUs:  -1,
			bandWidth:         Bandwidth(6000),
			cfsQuotaUs:        60000,
			changed:           true,
		},
		{
			beforeCfsPeriodUs: 5000,
			beforeCfsQuotaUs:  -1,
			bandWidth:         Bandwidth(6000),
			cfsQuotaUs:        30000,
			changed:           true,
		},
		{
			beforeCfsPeriodUs: 10000,
			beforeCfsQuotaUs:  60000,
			bandWidth:         Bandwidth(6000),
			cfsQuotaUs:        60000,
			changed:           false,
		},
	}
	for _, tc := range tests {
		tempdir := createTempDir(t, "cpu")
		err := cgroups.WriteFile(tempdir, "cpu.cfs_period_us", strconv.Itoa(tc.beforeCfsPeriodUs))
		if err != nil {
			t.Fatal(err)
		}
		err = cgroups.WriteFile(tempdir, "cpu.cfs_quota_us", strconv.Itoa(tc.beforeCfsQuotaUs))
		if err != nil {
			t.Fatal(err)
		}

		cfs := CgroupCFSController(tempdir)
		changed, err := cfs.SetLimit(tc.bandWidth)
		if err != nil {
			t.Fatal(err)
		}
		if changed != tc.changed {
			t.Fatalf("unexpected error: changed is '%v' but expected '%v'", changed, tc.changed)
		}
		cfsQuotaUs, err := cgroups.ReadFile(tempdir, "cpu.cfs_quota_us")
		if err != nil {
			t.Fatal(err)
		}
		if cfsQuotaUs != strconv.Itoa(tc.cfsQuotaUs) {
			t.Fatalf("unexpected error: cfsQuotaUs is '%v' but expected '%v'", cfsQuotaUs, tc.cfsQuotaUs)
		}
	}
}

func TestReadCfsQuota(t *testing.T) {
	type test struct {
		value  int
		expect int
	}
	tests := []test{
		{
			value:  100000,
			expect: 100000,
		},
		{
			value:  -1,
			expect: int(time.Duration(math.MaxInt64).Microseconds()),
		},
	}

	for _, tc := range tests {
		tempdir := createTempDir(t, "cpu")
		err := cgroups.WriteFile(tempdir, "cpu.cfs_quota_us", strconv.Itoa(tc.value))
		if err != nil {
			t.Fatal(err)
		}

		cfs := CgroupCFSController(tempdir)
		v, err := cfs.readCfsQuota()
		if err != nil {
			t.Fatal(err)
		}
		if v.Microseconds() != int64(tc.expect) {
			t.Fatalf("unexpected error: cfs quota is '%v' but expected '%v'", v, tc.expect)
		}
	}
}

func TestReadCfsPeriod(t *testing.T) {
	tests := []int{
		10000,
	}
	for _, tc := range tests {
		tempdir := createTempDir(t, "cpu")
		err := cgroups.WriteFile(tempdir, "cpu.cfs_period_us", strconv.Itoa(tc))
		if err != nil {
			t.Fatal(err)
		}

		cfs := CgroupCFSController(tempdir)
		v, err := cfs.readCfsPeriod()
		if err != nil {
			t.Fatal(err)
		}
		if v.Microseconds() != int64(tc) {
			t.Fatalf("unexpected error: cfs period is '%v' but expected '%v'", v, tc)
		}
	}
}

func TestReadCpuUsage(t *testing.T) {
	tests := []int{
		0,
		100000,
	}
	for _, tc := range tests {
		tempdir := createTempDir(t, "cpu")
		err := cgroups.WriteFile(tempdir, "cpuacct.usage", strconv.Itoa(tc))
		if err != nil {
			t.Fatal(err)
		}

		cfs := CgroupCFSController(tempdir)
		v, err := cfs.readCpuUsage()
		if err != nil {
			t.Fatal(err)
		}
		if v.Nanoseconds() != int64(tc) {
			t.Fatalf("unexpected error: cpu usage is '%v' but expected '%v'", v, tc)
		}
	}
}
