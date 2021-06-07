// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package bpf

// syscall flags
const (
	UF_NONE              uint32 = 0
	UF_USED              uint32 = (1 << 0)
	UF_NEVER_DROP        uint32 = (1 << 1)
	UF_ALWAYS_DROP       uint32 = (1 << 2)
	UF_SIMPLEDRIVER_KEEP uint32 = (1 << 3)
	UF_ATOMIC            uint32 = (1 << 4) // The handler should not block (interrupt context)
)

// ppme event types
const (
	PPME_SYSCALL_FORK_E      uint32 = 182
	PPME_SYSCALL_FORK_X      uint32 = 183
	PPME_SYSCALL_VFORK_E     uint32 = 184
	PPME_SYSCALL_VFORK_X     uint32 = 185
	PPME_SYSCALL_CLONE_20_E  uint32 = 222
	PPME_SYSCALL_CLONE_20_X  uint32 = 223
	PPME_SYSCALL_EXECVE_19_E uint32 = 292
	PPME_SYSCALL_EXECVE_19_X uint32 = 293
)
