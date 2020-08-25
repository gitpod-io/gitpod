// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package quota

import (
	"bufio"
	"io"
	"os"
	"os/exec"
	"strings"

	"golang.org/x/xerrors"
)

// mountPoint represents an entry in a proc mounts file
type mountPoint struct {
	Device string
	Path   string
	FS     string
	Opts   string
}

// findmountPointFromProc calls FindmountPoint with /proc/mounts
func findMountPointFromProc(dir string) (res *mountPoint, err error) {
	f, err := os.OpenFile("/proc/self/mounts", os.O_RDONLY, 0)
	if err != nil {
		return nil, xerrors.Errorf("cannot find mount point: %w", err)
	}
	defer f.Close()

	return findMountPoint(f, dir)
}

// findmountPoint finds the mount entry for a directory
func findMountPoint(mountFile io.Reader, dir string) (res *mountPoint, err error) {
	res = &mountPoint{}
	scanner := bufio.NewScanner(mountFile)
	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)

		if len(fields) < 4 {
			continue
		}

		if mp := fields[1]; strings.HasPrefix(dir, mp) && len(mp) > len(res.Path) {
			res.Device = fields[0]
			res.Path = fields[1]
			res.FS = fields[2]
			res.Opts = fields[3]
		}
	}
	if err = scanner.Err(); err != nil {
		res = nil
		return
	}
	if res.Path == "" {
		res = nil
	}

	return
}

// findLoopdevInLosetupOutput expects out to be the output of "losetup -a".
// It searches for lodev in that output and returns the backing filename.
// If the lodev isn't found it returns an empty string.
func findLoopdevInLosetupOutput(lodev string, out []byte) (fn string) {
	lines := strings.Split(string(out), "\n")
	for _, l := range lines {
		fields := strings.Fields(l)
		if len(fields) != 3 {
			continue
		}
		if fields[0] != lodev+":" {
			continue
		}

		return fields[2]
	}

	return ""
}

// findLoopdevBacking runs "losetup -a" and uses findLoopdevInLosetupOutput
// to find the backing file of the lodev. If the lodev isn't found, this function
// returns an empty string and nil error.
func findLoopdevBacking(lodev string) (fn string, err error) {
	out, err := exec.Command("losetup", "-a").CombinedOutput()
	if err != nil {
		return "", xerrors.Errorf("cannot run losetup: %w: %s", err, string(out))
	}

	return findLoopdevInLosetupOutput(lodev, out), nil
}
