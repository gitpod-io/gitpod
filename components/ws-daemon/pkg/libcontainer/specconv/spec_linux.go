// Copyright The libcontainer authors

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

// 	http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// gpl: Copied from: https://github.com/opencontainers/runc/blob/1f9e36c055b4eb97c38f8aae6ee50ca534962f77/libcontainer/specconv/spec_linux.go#L192
package specconv

import "github.com/opencontainers/runc/libcontainer/devices"

// AllowedDevices is the set of devices which are automatically included for
// all containers.
//
// # XXX (cyphar)
//
// This behaviour is at the very least "questionable" (if not outright
// wrong) according to the runtime-spec.
//
// Yes, we have to include certain devices other than the ones the user
// specifies, but several devices listed here are not part of the spec
// (including "mknod for any device"?!). In addition, these rules are
// appended to the user-provided set which means that users *cannot disable
// this behaviour*.
//
// ... unfortunately I'm too scared to change this now because who knows how
// many people depend on this (incorrect and arguably insecure) behaviour.
var AllowedDevices = []*devices.Device{
	// allow mknod for any device
	{
		Rule: devices.Rule{
			Type:        devices.CharDevice,
			Major:       devices.Wildcard,
			Minor:       devices.Wildcard,
			Permissions: "m",
			Allow:       true,
		},
	},
	{
		Rule: devices.Rule{
			Type:        devices.BlockDevice,
			Major:       devices.Wildcard,
			Minor:       devices.Wildcard,
			Permissions: "m",
			Allow:       true,
		},
	},
	{
		Path:     "/dev/null",
		FileMode: 0o666,
		Uid:      0,
		Gid:      0,
		Rule: devices.Rule{
			Type:        devices.CharDevice,
			Major:       1,
			Minor:       3,
			Permissions: "rwm",
			Allow:       true,
		},
	},
	{
		Path:     "/dev/random",
		FileMode: 0o666,
		Uid:      0,
		Gid:      0,
		Rule: devices.Rule{
			Type:        devices.CharDevice,
			Major:       1,
			Minor:       8,
			Permissions: "rwm",
			Allow:       true,
		},
	},
	{
		Path:     "/dev/full",
		FileMode: 0o666,
		Uid:      0,
		Gid:      0,
		Rule: devices.Rule{
			Type:        devices.CharDevice,
			Major:       1,
			Minor:       7,
			Permissions: "rwm",
			Allow:       true,
		},
	},
	{
		Path:     "/dev/tty",
		FileMode: 0o666,
		Uid:      0,
		Gid:      0,
		Rule: devices.Rule{
			Type:        devices.CharDevice,
			Major:       5,
			Minor:       0,
			Permissions: "rwm",
			Allow:       true,
		},
	},
	{
		Path:     "/dev/zero",
		FileMode: 0o666,
		Uid:      0,
		Gid:      0,
		Rule: devices.Rule{
			Type:        devices.CharDevice,
			Major:       1,
			Minor:       5,
			Permissions: "rwm",
			Allow:       true,
		},
	},
	{
		Path:     "/dev/urandom",
		FileMode: 0o666,
		Uid:      0,
		Gid:      0,
		Rule: devices.Rule{
			Type:        devices.CharDevice,
			Major:       1,
			Minor:       9,
			Permissions: "rwm",
			Allow:       true,
		},
	},
	// /dev/pts/ - pts namespaces are "coming soon"
	{
		Rule: devices.Rule{
			Type:        devices.CharDevice,
			Major:       136,
			Minor:       devices.Wildcard,
			Permissions: "rwm",
			Allow:       true,
		},
	},
	{
		Rule: devices.Rule{
			Type:        devices.CharDevice,
			Major:       5,
			Minor:       2,
			Permissions: "rwm",
			Allow:       true,
		},
	},
	// tuntap
	{
		Rule: devices.Rule{
			Type:        devices.CharDevice,
			Major:       10,
			Minor:       200,
			Permissions: "rwm",
			Allow:       true,
		},
	},
}
