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

type PPMEEventType uint32

// ppme event types
const (
	PPME_SOCKET_CONNECT_E    PPMEEventType = 22
	PPME_SOCKET_CONNECT_X    PPMEEventType = 23
	PPME_SYSCALL_FORK_E      PPMEEventType = 182
	PPME_SYSCALL_FORK_X      PPMEEventType = 183
	PPME_SYSCALL_VFORK_E     PPMEEventType = 184
	PPME_SYSCALL_VFORK_X     PPMEEventType = 185
	PPME_SYSCALL_CLONE_20_E  PPMEEventType = 222
	PPME_SYSCALL_CLONE_20_X  PPMEEventType = 223
	PPME_SYSCALL_EXECVE_19_E PPMEEventType = 292
	PPME_SYSCALL_EXECVE_19_X PPMEEventType = 293
)
