// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:build linux
// +build linux

/*
   Copyright The containerd Authors.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

package main

import (
	"fmt"
	"os"

	"golang.org/x/sys/unix"
)

func mountIDMapped(target string, pid int) (err error) {
	var (
		path       string
		attr       unix.MountAttr
		userNsFile *os.File
		targetDir  *os.File
	)

	path = fmt.Sprintf("/proc/%d/ns/user", pid)
	if userNsFile, err = os.Open(path); err != nil {
		return fmt.Errorf("Unable to get user ns file descriptor for - %s, %w", path, err)
	}

	attr.Attr_set = unix.MOUNT_ATTR_IDMAP
	attr.Attr_clr = 0
	attr.Propagation = 0
	attr.Userns_fd = uint64(userNsFile.Fd())

	defer userNsFile.Close()
	if targetDir, err = os.Open(target); err != nil {
		return fmt.Errorf("Unable to get mount point target file descriptor - %s, %w", target, err)
	}

	defer targetDir.Close()
	return unix.MountSetattr(int(targetDir.Fd()), "", unix.AT_EMPTY_PATH|unix.AT_RECURSIVE, &attr)
}
