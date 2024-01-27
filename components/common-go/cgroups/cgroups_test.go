// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cgroups

import (
	"math"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
)

var cgroupPath = []string{"/kubepods", "burstable", "pods234sdf", "234as8df34"}

func createHierarchy(t *testing.T, cpuEnabled bool) (string, string) {
	testRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(testRoot, "cgroup.controllers"), []byte(""), 0755); err != nil {
		t.Fatal(err)
	}

	if err := os.WriteFile(filepath.Join(testRoot, "cgroup.subtree_control"), []byte(""), 0755); err != nil {
		t.Fatal(err)
	}

	testCgroup := ""
	for i, level := range cgroupPath {
		testCgroup = filepath.Join(testCgroup, level)
		fullPath := filepath.Join(testRoot, testCgroup)
		if err := os.Mkdir(fullPath, 0o755); err != nil {
			t.Fatal(err)
		}

		ctrlFile, err := os.Create(filepath.Join(fullPath, "cgroup.controllers"))
		if err != nil {
			t.Fatal(err)
		}
		defer ctrlFile.Close()

		if cpuEnabled {
			if _, err := ctrlFile.WriteString("cpu"); err != nil {
				t.Fatal(err)
			}
		}

		subTreeFile, err := os.Create(filepath.Join(fullPath, "cgroup.subtree_control"))
		if err != nil {
			t.Fatal(err)
		}
		defer subTreeFile.Close()

		if cpuEnabled && i < len(cgroupPath)-1 {
			if _, err := subTreeFile.WriteString("cpu"); err != nil {
				t.Fatal(err)
			}
		}
	}

	return testRoot, testCgroup
}

func TestEnableController(t *testing.T) {
	root, cgroup := createHierarchy(t, false)
	if err := EnsureCpuControllerEnabled(root, cgroup); err != nil {
		t.Fatal(err)
	}

	levelPath := root
	for _, level := range cgroupPath {
		verifyCpuControllerToggled(t, levelPath, true)
		levelPath = filepath.Join(levelPath, level)
	}

	verifyCpuControllerToggled(t, levelPath, false)
}

func verifyCpuControllerToggled(t *testing.T, path string, enabled bool) {
	t.Helper()

	content, err := os.ReadFile(filepath.Join(path, "cgroup.subtree_control"))
	if err != nil {
		t.Fatal(err)
	}

	if enabled && string(content) != "+cpu" {
		t.Fatalf("%s should have enabled cpu controller", path)
	} else if !enabled && string(content) == "+cpu" {
		t.Fatalf("%s should not have enabled cpu controller", path)
	}
}

func TestReadSingleValue(t *testing.T) {
	scenarios := []struct {
		name     string
		content  string
		expected uint64
	}{
		{
			name:     "cgroup2 max value",
			content:  "max",
			expected: math.MaxUint64,
		},
		{
			name:     "cgroup1 max value",
			content:  "-1",
			expected: math.MaxUint64,
		},
		{
			name:     "valid value",
			content:  "100000",
			expected: 100_000,
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			f, err := os.CreateTemp("", "cgroup_test*")
			if err != nil {
				t.Fatal(err)
			}

			if _, err := f.Write([]byte(s.content)); err != nil {
				t.Fatal(err)
			}

			v, err := ReadSingleValue(f.Name())
			if err != nil {
				t.Fatal(err)
			}

			assert.Equal(t, s.expected, v)
		})
	}
}

func TestReadPSI(t *testing.T) {
	scenarios := []struct {
		name     string
		content  string
		expected PSI
	}{
		{
			name:    "psi some",
			content: "some avg10=61.00 avg60=64.28 avg300=29.94 total=149969752",
			expected: PSI{
				Some: 149969752,
				Full: 0,
			},
		},
		{
			name:    "psi full",
			content: "full avg10=36.27 avg60=37.15 avg300=17.59 total=93027571",
			expected: PSI{
				Some: 0,
				Full: 93027571,
			},
		},
		{
			name:    "psi some and full",
			content: "some avg10=61.00 avg60=64.28 avg300=29.94 total=149969752\nfull avg10=36.27 avg60=37.15 avg300=17.59 total=93027571",
			expected: PSI{
				Some: 149969752,
				Full: 93027571,
			},
		},
	}

	for _, s := range scenarios {
		t.Run(s.name, func(t *testing.T) {
			f, err := os.CreateTemp("", "cgroup_test*")
			if err != nil {
				t.Fatal(err)
			}
			defer os.Remove(f.Name())

			if _, err := f.Write([]byte(s.content)); err != nil {
				t.Fatal(err)
			}

			v, err := ReadPSIValue(f.Name())
			if err != nil {
				t.Fatal(err)
			}

			assert.Equal(t, s.expected, v)
		})
	}
}
