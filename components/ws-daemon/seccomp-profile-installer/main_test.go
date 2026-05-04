// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"slices"
	"syscall"
	"testing"

	"github.com/opencontainers/runtime-spec/specs-go"
)

func TestDefaultWorkspaceSeccompProfileBlocksAFALGSocket(t *testing.T) {
	profile := defaultWorkspaceSeccompProfile([]string{"AUDIT_WRITE", "NET_BIND_SERVICE"})

	for _, syscallRule := range profile.Syscalls {
		if !slices.Contains(syscallRule.Names, "socket") || syscallRule.Action != specs.ActErrno {
			continue
		}

		for _, arg := range syscallRule.Args {
			if arg.Index == 0 && arg.Value == syscall.AF_ALG && arg.Op == specs.OpEqualTo {
				return
			}
		}
	}

	t.Fatalf("expected seccomp profile to block socket(AF_ALG, ...)")
}

func TestDefaultWorkspaceSeccompProfileKeepsRegularSocketsAvailable(t *testing.T) {
	profile := defaultWorkspaceSeccompProfile([]string{"AUDIT_WRITE", "NET_BIND_SERVICE"})

	for _, syscallRule := range profile.Syscalls {
		if slices.Contains(syscallRule.Names, "socket") && syscallRule.Action == specs.ActAllow && len(syscallRule.Args) == 0 {
			return
		}
	}

	t.Fatalf("expected seccomp profile to preserve generic socket allow rule")
}
