// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package rings

import (
	"bufio"
	"io"
	"os"
	"path/filepath"
	"strings"
)

var (
	knownMountCandidatePaths = []string{
		"/workspace",
		"/sys",
		"/dev",
		"/etc/hosts",
		"/etc/hostname",
	}
	rejectMountPaths = map[string]struct{}{
		"/etc/resolv.conf": {},
	}
)

// FindBindMountCandidates attempts to find bind mount candidates in the ring0 mount namespace.
// It does that by either checking for knownMountCandidatePaths, or after rejecting based on filesystems (e.g. cgroup or proc),
// checking if in the root of the mountpoint there's a `..data` symlink pointing to a file starting with `..`.
// That's how configMaps and secrets behave in Kubernetes.
//
// Note/Caveat: configMap or secret volumes with a subPath do not behave as described above and will not be recognised by this function.
//              in those cases you'll want to use GITPOD_WORKSPACEKIT_BIND_MOUNTS to explicitely list those paths.
func FindBindMountCandidates(procMounts io.Reader, readlink func(path string) (dest string, err error)) (mounts []string, err error) {
	scanner := bufio.NewScanner(procMounts)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 4 {
			continue
		}

		// accept known paths
		var (
			path   = fields[1]
			accept bool
		)
		for _, p := range knownMountCandidatePaths {
			if p == path {
				accept = true
				break
			}
		}
		if accept {
			mounts = append(mounts, path)
			continue
		}

		// reject known filesystems
		var (
			fs     = fields[0]
			reject bool
		)
		switch fs {
		case "cgroup", "devpts", "mqueue", "shm", "proc", "sysfs":
			reject = true
		}
		if reject {
			continue
		}

		// reject known paths
		if _, ok := rejectMountPaths[path]; ok {
			continue
		}

		// test remaining candidates if they're a Kubernetes configMap or secret
		ln, err := readlink(filepath.Join(path, "..data"))
		if err != nil {
			continue
		}
		if !strings.HasPrefix(ln, "..") {
			continue
		}

		mounts = append(mounts, path)
	}
	return mounts, scanner.Err()
}

// CopyResolvConf copies /etc/resolv.conf to <ring2root>/etc/resolv.conf
func CopyResolvConf(rootfs string) error {
	fn := "/etc/resolv.conf"
	stat, err := os.Stat(fn)
	if err != nil {
		return err
	}

	org, err := os.Open(fn)
	if err != nil {
		return err
	}
	defer org.Close()

	dst, err := os.OpenFile(filepath.Join(rootfs, fn), os.O_CREATE|os.O_TRUNC|os.O_WRONLY, stat.Mode())
	if err != nil {
		return err
	}
	defer dst.Close()

	_, err = io.Copy(dst, org)
	if err != nil {
		return err
	}

	return nil
}
