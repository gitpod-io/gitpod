// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package v2

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMax(t *testing.T) {
	mountPoint := createMaxFile(t)

	cpu := NewCpuControllerWithMount(mountPoint, "cgroup")
	quota, period, err := cpu.Max()
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, uint64(200_000), quota)
	assert.Equal(t, uint64(100_000), period)
}

func createMaxFile(t *testing.T) string {
	mountPoint, err := os.MkdirTemp("", "test.max")
	if err != nil {
		t.Fatal(err)
	}
	cgroupPath := filepath.Join(mountPoint, "cgroup")
	if err := os.MkdirAll(cgroupPath, 0755); err != nil {
		t.Fatal(err)
	}

	if err := os.WriteFile(filepath.Join(cgroupPath, "cpu.max"), []byte("200000 100000\n"), 0755); err != nil {
		t.Fatalf("failed to create cpu.max file: %v", err)
	}

	return mountPoint
}
