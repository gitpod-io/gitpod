// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"encoding/json"
	"log"
	"os"

	"github.com/containerd/containerd/contrib/seccomp"
	"github.com/opencontainers/runtime-spec/specs-go"
)

func main() {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)

	spec := specs.Spec{
		Process: &specs.Process{
			Capabilities: &specs.LinuxCapabilities{
				Bounding: os.Args[1:],
			},
		},
	}

	s := seccomp.DefaultProfile(&spec)
	s.Syscalls = append(s.Syscalls,
		specs.LinuxSyscall{
			Names: []string{
				"clone",
				"mount",
				"umount2",
				"chroot",
				"pivot_root",
				"setdomainname",
				"sethostname",
				"unshare",
			},
			Action: specs.ActAllow,
		},

		// slirp4netns requires setns, as do we for debugging
		// TODO(cw): find means to make this more precise, maybe an eBPF program that checks if
		//           arg zero is a child of this netns. The kernel already does that (from the setns(2) man page):
		//              In order to reassociate itself with a new network, IPC, time,
		//              or UTS namespace, the caller must have the CAP_SYS_ADMIN capa‐
		//              bility both in its own user namespace and in the user names‐
		//              pace that owns the target namespace.
		specs.LinuxSyscall{
			Names:  []string{"setns"},
			Action: specs.ActAllow,
		},
		specs.LinuxSyscall{
			Names: []string{
				"keyctl",
			},
			// prevent call and return ENOSYS to make runc happy
			// (see https://github.com/opencontainers/runc/issues/1889)
			Action: specs.ActTrace,
		},
	)

	err := enc.Encode(s)
	if err != nil {
		log.Fatalf("cannot marshal seccomp profile: %q", err)
	}
}
