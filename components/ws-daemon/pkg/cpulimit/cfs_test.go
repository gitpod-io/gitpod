// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cpulimit

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"

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
