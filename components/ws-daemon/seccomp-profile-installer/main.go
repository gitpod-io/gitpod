// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"encoding/json"
	"log"
	"os"
	"syscall"

	"github.com/containerd/containerd/contrib/seccomp"
	"github.com/opencontainers/runtime-spec/specs-go"
)

func defaultWorkspaceSeccompProfile(capabilities []string) *specs.LinuxSeccomp {
	spec := specs.Spec{
		Process: &specs.Process{
			Capabilities: &specs.LinuxCapabilities{
				Bounding: capabilities,
			},
		},
	}

	s := seccomp.DefaultProfile(&spec)
	s.Syscalls = append(s.Syscalls,
		// AF_ALG exposes the kernel crypto API via sockets. Blocking only this
		// family keeps regular networking intact while removing the copy.fail path.
		specs.LinuxSyscall{
			Names:  []string{"socket"},
			Action: specs.ActErrno,
			Args: []specs.LinuxSeccompArg{
				{
					Index: 0,
					Value: syscall.AF_ALG,
					Op:    specs.OpEqualTo,
				},
			},
		},
		specs.LinuxSyscall{
			Names: []string{
				"clone",
				"clone3",
				"mount",
				"umount2",
				"chroot",
				"pivot_root",
				"setdomainname",
				"sethostname",
				"unshare",
				"keyctl",
				"add_key",
				"request_key",
			},
			Action: specs.ActAllow,
		},

		// Running docker on a workspace requires setns
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
	)

	return s
}

func main() {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)

	s := defaultWorkspaceSeccompProfile(os.Args[1:])

	err := enc.Encode(s)
	if err != nil {
		log.Fatalf("cannot marshal seccomp profile: %q", err)
	}
}
