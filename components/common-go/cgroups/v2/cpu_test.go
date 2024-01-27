// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cgroups_v2

import (
	"fmt"
	"math"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMax(t *testing.T) {
	values := []struct {
		scenario       string
		fileQuota      string
		filePeriod     string
		expectedQuota  uint64
		expectedPeriod uint64
	}{
		{
			scenario:       "cpu consumption is restricted",
			fileQuota:      "200000",
			filePeriod:     "100000",
			expectedQuota:  200_000,
			expectedPeriod: 100_000,
		},
		{
			scenario:       "cpu consumption is unrestricted",
			fileQuota:      "max",
			filePeriod:     "100000",
			expectedQuota:  math.MaxUint64,
			expectedPeriod: 100_000,
		},
	}

	for _, v := range values {
		mountPoint := createMaxFile(t, v.fileQuota, v.filePeriod)
		cpu := NewCpuControllerWithMount(mountPoint, "cgroup")
		quota, period, err := cpu.Max()
		if err != nil {
			t.Fatal(err)
		}

		assert.Equal(t, uint64(v.expectedQuota), quota, v.scenario)
		assert.Equal(t, uint64(v.expectedPeriod), period, v.scenario)
	}
}

func TestMaxNotExist(t *testing.T) {
	cpu := NewCpuControllerWithMount("/this/does/not", "exist")
	_, _, err := cpu.Max()

	assert.ErrorIs(t, err, os.ErrNotExist)
}

func createMaxFile(t *testing.T, quota, period string) string {
	mountPoint, err := os.MkdirTemp("", "test.max")
	if err != nil {
		t.Fatal(err)
	}
	cgroupPath := filepath.Join(mountPoint, "cgroup")
	if err := os.MkdirAll(cgroupPath, 0755); err != nil {
		t.Fatal(err)
	}

	if err := os.WriteFile(filepath.Join(cgroupPath, "cpu.max"), []byte(fmt.Sprintf("%v %v\n", quota, period)), 0755); err != nil {
		t.Fatalf("failed to create cpu.max file: %v", err)
	}

	return mountPoint
}
