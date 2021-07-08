// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"fmt"
	"os"
	"strconv"

	"github.com/containerd/cgroups"
	"github.com/opencontainers/runtime-spec/specs-go"
	"github.com/prometheus/procfs"
)

var fuseDeviceMajor int64 = 10
var fuseDeviceMinor int64 = 229

func main() {
	if len(os.Args) < 2 {
		fmt.Printf("USAGE:\n  %s <pid>\n", os.Args[0])
		os.Exit(1)
	}
	pid, err := strconv.Atoi(os.Args[1])

	if err != nil {
		fmt.Printf("provided process id is invalid: %v\n", err)
		os.Exit(1)
	}

	pfs, err := procfs.NewProc(pid)
	if err != nil {
		fmt.Printf("error looking for process: %v\n", err)
		os.Exit(1)
	}

	groups, err := pfs.Cgroups()
	if err != nil {
		fmt.Printf("error listing cgroups: %v\n", err)
		os.Exit(1)
	}

	cgroupPath := ""

	for _, g := range groups {
		for _, c := range g.Controllers {
			if c == "devices" {
				cgroupPath = g.Path
			}
		}
	}

	if len(cgroupPath) == 0 {
		fmt.Println("could not find cgroup path")
		os.Exit(1)
	}

	control, err := cgroups.Load(cgroups.V1, cgroups.StaticPath(cgroupPath))

	if err != nil {
		fmt.Printf("error loading cgroup: %v\n", err)
		os.Exit(1)
	}

	res := &specs.LinuxResources{
		Devices: []specs.LinuxDeviceCgroup{
			// /dev/fuse
			{
				Type:   "c",
				Minor:  &fuseDeviceMinor,
				Major:  &fuseDeviceMajor,
				Access: "rwm",
				Allow:  true,
			},
		},
	}

	if err := control.Update(res); err != nil {
		fmt.Printf("cgroup update failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("cgroup updated, path: %s\n", cgroupPath)
}
