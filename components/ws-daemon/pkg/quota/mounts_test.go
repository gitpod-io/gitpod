// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package quota

import (
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
)

const (
	mountTable00 = `group /sys/fs/cgroup/freezer cgroup rw,nosuid,nodev,noexec,relatime,freezer 0 0
/dev/sdb /workspace ext4 rw,relatime,discard,data=ordered 0 0
/dev/sdb /theia ext4 ro,relatime,discard,data=ordered 0 0`
	losetupAOut00 = `/dev/loop0: 0 /tmp/test
/dev/loop1: 0 /mnt/workingarea/10.sandbox
/dev/loop2: 0 /mnt/workingarea/20.sandbox
/dev/loop3: 0 /mnt/workingarea/30.sandbox
/dev/loop4: 0 /mnt/workingarea/40.sandbox
/dev/loop5: 0 /mnt/workingarea/50.sandbox
/dev/loop6: 0 /mnt/workingarea/60.sandbox
/dev/loop7: 0 /mnt/workingarea/70.sandbox`
)

func TestFindMountPoint(t *testing.T) {
	tests := []struct {
		Desc        string
		MountTable  string
		Dir         string
		Expectation *mountPoint
	}{
		{"valid rootpath", mountTable00, "/workspace", &mountPoint{Device: "/dev/sdb", Path: "/workspace", FS: "ext4", Opts: "rw,relatime,discard,data=ordered"}},
		{"valid subpath", mountTable00, "/workspace/foobar", &mountPoint{Device: "/dev/sdb", Path: "/workspace", FS: "ext4", Opts: "rw,relatime,discard,data=ordered"}},
		{"not found", mountTable00, "/fofofofo", nil},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			mp, err := findMountPoint(strings.NewReader(test.MountTable), test.Dir)
			if err != nil {
				t.Error(err)
				return
			}

			if diff := cmp.Diff(test.Expectation, mp); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}

func TestFindLoopdevInLosetupOutput(t *testing.T) {
	tests := []struct {
		Desc        string
		Losetup     string
		Lodev       string
		Expectation string
	}{
		{"valid lodev", losetupAOut00, "/dev/loop1", "/mnt/workingarea/10.sandbox"},
		{"not found", losetupAOut00, "/fofofofo", ""},
	}

	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			act := findLoopdevInLosetupOutput(test.Lodev, []byte(test.Losetup))

			if act != test.Expectation {
				t.Errorf("unexpected result: %s, expected: %s", act, test.Expectation)
			}
		})
	}
}
