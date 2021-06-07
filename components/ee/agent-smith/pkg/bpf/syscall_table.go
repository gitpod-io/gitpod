package bpf

import "golang.org/x/sys/unix"

type SyscallEventPair struct {
	Flags          uint32
	EnterEventType uint32
	ExitEventType  uint32
}

var SyscallsTable = map[uint32]SyscallEventPair{
	unix.SYS_EXECVE: {Flags: UF_USED | UF_NEVER_DROP | UF_SIMPLEDRIVER_KEEP, EnterEventType: PPME_SYSCALL_EXECVE_19_E, ExitEventType: PPME_SYSCALL_EXECVE_19_X},
	// unix.SYS_CLONE:  {Flags: UF_USED | UF_NEVER_DROP | UF_SIMPLEDRIVER_KEEP, EnterEventType: PPME_SYSCALL_CLONE_20_E, ExitEventType: PPME_SYSCALL_CLONE_20_X},
	// unix.SYS_FORK:   {Flags: UF_USED | UF_NEVER_DROP | UF_SIMPLEDRIVER_KEEP, EnterEventType: PPME_SYSCALL_FORK_E, ExitEventType: PPME_SYSCALL_FORK_X},
	// unix.SYS_VFORK:  {Flags: UF_USED | UF_NEVER_DROP | UF_SIMPLEDRIVER_KEEP, EnterEventType: PPME_SYSCALL_VFORK_E, ExitEventType: PPME_SYSCALL_VFORK_X},
}
