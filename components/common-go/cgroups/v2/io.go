// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cgroups_v2

import (
	"path/filepath"

	"github.com/gitpod-io/gitpod/common-go/cgroups"
)

type IO struct {
	path string
}

func NewIOControllerWithMount(mountPoint, path string) *IO {
	fullPath := filepath.Join(mountPoint, path)
	return &IO{
		path: fullPath,
	}
}

func NewIOController(path string) *IO {
	return &IO{
		path: path,
	}
}

func (io *IO) PSI() (cgroups.PSI, error) {
	path := filepath.Join(io.path, "io.pressure")
	return cgroups.ReadPSIValue(path)
}

func (io *IO) Max() ([]cgroups.DeviceIOMax, error) {
	path := filepath.Join(io.path, "io.max")
	return cgroups.ReadIOMax(path)
}
