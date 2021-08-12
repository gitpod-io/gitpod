// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package bpf

// clone flags
const (
	PPM_CL_NONE                uint32 = 0
	PPM_CL_CLONE_FILES         uint32 = (1 << 0)
	PPM_CL_CLONE_FS            uint32 = (1 << 1)
	PPM_CL_CLONE_IO            uint32 = (1 << 2)
	PPM_CL_CLONE_NEWIPC        uint32 = (1 << 3)
	PPM_CL_CLONE_NEWNET        uint32 = (1 << 4)
	PPM_CL_CLONE_NEWNS         uint32 = (1 << 5)
	PPM_CL_CLONE_NEWPID        uint32 = (1 << 6)
	PPM_CL_CLONE_NEWUTS        uint32 = (1 << 7)
	PPM_CL_CLONE_PARENT        uint32 = (1 << 8)
	PPM_CL_CLONE_PARENT_SETTID uint32 = (1 << 9)
	PPM_CL_CLONE_PTRACE        uint32 = (1 << 10)
	PPM_CL_CLONE_SIGHAND       uint32 = (1 << 11)
	PPM_CL_CLONE_SYSVSEM       uint32 = (1 << 12)
	PPM_CL_CLONE_THREAD        uint32 = (1 << 13)
	PPM_CL_CLONE_UNTRACED      uint32 = (1 << 14)
	PPM_CL_CLONE_VM            uint32 = (1 << 15)
	PPM_CL_CLONE_INVERTED      uint32 = (1 << 16) /* libsinsp-specific flag. It's set if clone() returned in */
	/* uint32 the child process before than in the parent process. */
	PPM_CL_NAME_CHANGED uint32 = (1 << 17) /* libsinsp-specific flag. Set when the thread name changes */
	/* uint32 (for example because execve was called) */
	PPM_CL_CLOSED uint32 = (1 << 18) /* thread has been closed. */
	PPM_CL_ACTIVE uint32 = (1 << 19) /* libsinsp-specific flag. Set in the first non-clone event for
	   this uint32 thread. */
	PPM_CL_CLONE_NEWUSER uint32 = (1 << 20)
	PPM_CL_PIPE_SRC      uint32 = (1 << 21) /* libsinsp-specific flag. Set if this thread has been
	   detected uint32 to be the source in a shell pipe. */
	PPM_CL_PIPE_DST uint32 = (1 << 22) /* libsinsp-specific flag. Set if this thread has been
	   detected uint32 to be the destination in a shell pipe. */
	PPM_CL_CLONE_CHILD_CLEARTID uint32 = (1 << 23)
	PPM_CL_CLONE_CHILD_SETTID   uint32 = (1 << 24)
	PPM_CL_CLONE_SETTLS         uint32 = (1 << 25)
	PPM_CL_CLONE_STOPPED        uint32 = (1 << 26)
	PPM_CL_CLONE_VFORK          uint32 = (1 << 27)
	PPM_CL_CLONE_NEWCGROUP      uint32 = (1 << 28)
	PPM_CL_CHILD_IN_PIDNS       uint32 = (1 << 29) /* true if the thread created by clone() is *not*
	in uint32 the init pid namespace */
	PPM_CL_IS_MAIN_THREAD uint32 = (1 << 30) /* libsinsp-specific flag. Set if this is the main thread in envs where main thread tid != pid.*/
)

// clone flags strings
var (
	CLONE_FILES          = []byte("CLONE_FILES")
	CLONE_FS             = []byte("CLONE_FS")
	CLONE_IO             = []byte("CLONE_IO")
	CLONE_NEWIPC         = []byte("CLONE_NEWIPC")
	CLONE_NEWNET         = []byte("CLONE_NEWNET")
	CLONE_NEWNS          = []byte("CLONE_NEWNS")
	CLONE_NEWPID         = []byte("CLONE_NEWPID")
	CLONE_NEWUTS         = []byte("CLONE_NEWUTS")
	CLONE_PARENT         = []byte("CLONE_PARENT")
	CLONE_PARENT_SETTID  = []byte("CLONE_PARENT_SETTID")
	CLONE_PTRACE         = []byte("CLONE_PTRACE")
	CLONE_SIGHAND        = []byte("CLONE_SIGHAND")
	CLONE_SYSVSEM        = []byte("CLONE_SYSVSEM")
	CLONE_THREAD         = []byte("CLONE_THREAD")
	CLONE_UNTRACED       = []byte("CLONE_UNTRACED")
	CLONE_VM             = []byte("CLONE_VM")
	CLONE_INVERTED       = []byte("CLONE_INVERTED")
	NAME_CHANGED         = []byte("NAME_CHANGED")
	CLOSED               = []byte("CLOSED")
	CLONE_NEWUSER        = []byte("CLONE_NEWUSER")
	CLONE_CHILD_CLEARTID = []byte("CLONE_CHILD_CLEARTID")
	CLONE_CHILD_SETTID   = []byte("CLONE_CHILD_SETTID")
	CLONE_SETTLS         = []byte("CLONE_SETTLS")
	CLONE_STOPPED        = []byte("CLONE_STOPPED")
	CLONE_VFORK          = []byte("CLONE_VFORK")
	CLONE_NEWCGROUP      = []byte("CLONE_NEWCGROUP")
)

//nolint:deadcode,unused,varcheck
var cloneFlags = []PPMNameValue{
	{&CLONE_FILES, PPM_CL_CLONE_FILES},
	{&CLONE_FS, PPM_CL_CLONE_FS},
	{&CLONE_IO, PPM_CL_CLONE_IO},
	{&CLONE_NEWIPC, PPM_CL_CLONE_NEWIPC},
	{&CLONE_NEWNET, PPM_CL_CLONE_NEWNET},
	{&CLONE_NEWNS, PPM_CL_CLONE_NEWNS},
	{&CLONE_NEWPID, PPM_CL_CLONE_NEWPID},
	{&CLONE_NEWUTS, PPM_CL_CLONE_NEWUTS},
	{&CLONE_PARENT, PPM_CL_CLONE_PARENT},
	{&CLONE_PARENT_SETTID, PPM_CL_CLONE_PARENT_SETTID},
	{&CLONE_PTRACE, PPM_CL_CLONE_PTRACE},
	{&CLONE_SIGHAND, PPM_CL_CLONE_SIGHAND},
	{&CLONE_SYSVSEM, PPM_CL_CLONE_SYSVSEM},
	{&CLONE_THREAD, PPM_CL_CLONE_THREAD},
	{&CLONE_UNTRACED, PPM_CL_CLONE_UNTRACED},
	{&CLONE_VM, PPM_CL_CLONE_VM},
	{&CLONE_INVERTED, PPM_CL_CLONE_INVERTED},
	{&NAME_CHANGED, PPM_CL_NAME_CHANGED},
	{&CLOSED, PPM_CL_CLOSED},
	{&CLONE_NEWUSER, PPM_CL_CLONE_NEWUSER},
	{&CLONE_CHILD_CLEARTID, PPM_CL_CLONE_CHILD_CLEARTID},
	{&CLONE_CHILD_SETTID, PPM_CL_CLONE_CHILD_SETTID},
	{&CLONE_SETTLS, PPM_CL_CLONE_SETTLS},
	{&CLONE_STOPPED, PPM_CL_CLONE_STOPPED},
	{&CLONE_VFORK, PPM_CL_CLONE_VFORK},
	{&CLONE_NEWCGROUP, PPM_CL_CLONE_NEWCGROUP},
}
