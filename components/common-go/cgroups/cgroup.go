// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cgroups

import (
	"os"
	"path/filepath"
	"strings"
)

const DefaultCGroupMount = "/sys/fs/cgroup"

type CgroupSetup int

const (
	Unknown CgroupSetup = iota
	Legacy
	Unified
)

func (s CgroupSetup) String() string {
	return [...]string{"Legacy", "Unified"}[s]
}

func GetCgroupSetup() (CgroupSetup, error) {
	controllers := filepath.Join(DefaultCGroupMount, "cgroup.controllers")
	_, err := os.Stat(controllers)

	if os.IsNotExist(err) {
		return Legacy, nil
	}

	if err == nil {
		return Unified, nil
	}

	return Unknown, err
}

func IsUnifiedCgroupSetup() (bool, error) {
	setup, err := GetCgroupSetup()
	if err != nil {
		return false, err
	}

	return setup == Unified, nil
}

func IsLegacyCgroupSetup() (bool, error) {
	setup, err := GetCgroupSetup()
	if err != nil {
		return false, err
	}

	return setup == Legacy, nil
}

func EnsureCpuControllerEnabled(basePath, cgroupPath string) error {
	targetPath := filepath.Join(basePath, cgroupPath)
	if enabled, err := isCpuControllerEnabled(targetPath); err != nil || enabled {
		return err
	}

	err := writeCpuController(basePath)
	if err != nil {
		return err
	}

	levelPath := basePath
	cgroupPath = strings.TrimPrefix(cgroupPath, "/")
	levels := strings.Split(cgroupPath, string(os.PathSeparator))
	for _, l := range levels[:len(levels)-1] {
		levelPath = filepath.Join(levelPath, l)
		err = writeCpuController(levelPath)
		if err != nil {
			return err
		}
	}

	return nil
}

func isCpuControllerEnabled(path string) (bool, error) {
	controllerFile := filepath.Join(path, "cgroup.controllers")
	controllers, err := os.ReadFile(controllerFile)
	if err != nil {
		return false, err
	}

	for _, ctrl := range strings.Fields(string(controllers)) {
		if ctrl == "cpu" {
			// controller is already activated
			return true, nil
		}
	}

	return false, nil
}

func writeCpuController(path string) error {
	f, err := os.OpenFile(filepath.Join(path, "cgroup.subtree_control"), os.O_WRONLY, 0)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = f.Write([]byte("+cpu"))
	if err != nil {
		return err
	}

	return nil
}
