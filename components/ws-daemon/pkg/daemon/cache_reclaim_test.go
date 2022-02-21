// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package daemon

import (
	"fmt"
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

func TestReadLimit(t *testing.T) {
	const limit = 4096
	tempdir := createTempDir(t, "memory")
	err := cgroups.WriteFile(tempdir, "memory.limit_in_bytes", strconv.Itoa(limit))
	if err != nil {
		t.Fatal(err)
	}
	value, err := readLimit(tempdir)
	if err != nil {
		t.Fatal(err)
	}
	if value != limit {
		t.Fatalf("unexpected error: is '%v' but expected '%v'", value, limit)
	}
}

func TestReadLimitBadValue(t *testing.T) {
	invalidValues := []string{
		"invalid",
		"-1",
	}
	tempdir := createTempDir(t, "memory")
	for _, v := range invalidValues {
		err := cgroups.WriteFile(tempdir, "memory.limit_in_bytes", v)
		if err != nil {
			t.Fatal(err)
		}
		_, err = readCache(tempdir)
		if err != nil {
			t.Fatalf("unexpected error: is '%v' but expected no error", err)
		}
	}
}

func TestReadCache(t *testing.T) {
	const cache = 512
	tempdir := createTempDir(t, "memory")
	err := cgroups.WriteFile(tempdir, "memory.stat", fmt.Sprintf("cache %d\nrss 1024", cache))
	if err != nil {
		t.Fatal(err)
	}
	value, err := readCache(tempdir)
	if err != nil {
		t.Fatal(err)
	}
	if value != cache {
		t.Fatalf("unexpected error: is '%v' but expected '%v'", value, cache)
	}
}

func TestReadCacheBadValue(t *testing.T) {
	invalidValues := []string{
		"invalid",
		"cache -1",
	}
	tempdir := createTempDir(t, "memory")
	for _, v := range invalidValues {
		err := cgroups.WriteFile(tempdir, "memory.stat", v)
		if err != nil {
			t.Fatal(err)
		}
		_, err = readCache(tempdir)
		if err == nil {
			t.Fatal("expected failure")
		}
	}
}
