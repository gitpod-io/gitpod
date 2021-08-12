// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package bpf

import (
	"golang.org/x/sys/unix"
)

type SyscallEventPair struct {
	Flags          uint32
	EnterEventType PPMEEventType
	ExitEventType  PPMEEventType
}

var SyscallsTable = map[uint32]SyscallEventPair{
	unix.SYS_CONNECT: {Flags: UF_USED | UF_NEVER_DROP | UF_SIMPLEDRIVER_KEEP, EnterEventType: PPME_SOCKET_CONNECT_E, ExitEventType: PPME_SOCKET_CONNECT_X}, // fixme > do we want UF_NEVER_DROP?
	unix.SYS_EXECVE:  {Flags: UF_USED | UF_NEVER_DROP | UF_SIMPLEDRIVER_KEEP, EnterEventType: PPME_SYSCALL_EXECVE_19_E, ExitEventType: PPME_SYSCALL_EXECVE_19_X},
	// unix.SYS_CLONE:  {Flags: UF_USED | UF_NEVER_DROP | UF_SIMPLEDRIVER_KEEP, EnterEventType: PPME_SYSCALL_CLONE_20_E, ExitEventType: PPME_SYSCALL_CLONE_20_X},
	// unix.SYS_FORK:   {Flags: UF_USED | UF_NEVER_DROP | UF_SIMPLEDRIVER_KEEP, EnterEventType: PPME_SYSCALL_FORK_E, ExitEventType: PPME_SYSCALL_FORK_X},
	// unix.SYS_VFORK:  {Flags: UF_USED | UF_NEVER_DROP | UF_SIMPLEDRIVER_KEEP, EnterEventType: PPME_SYSCALL_VFORK_E, ExitEventType: PPME_SYSCALL_VFORK_X},
}
