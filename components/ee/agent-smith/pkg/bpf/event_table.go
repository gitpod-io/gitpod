// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package bpf

const (
	PPM_MAX_EVENT_PARAMS uint32 = (1 << 5) /* Max number of parameters an event can have */
	PPM_MAX_NAME_LEN     uint32 = 32
	PPM_MAX_PATH_SIZE    uint32 = 256
)

// event categories
const (
	EC_UNKNOWN    uint32 = 0   /* Unknown */
	EC_OTHER      uint32 = 1   /* No specific category */
	EC_FILE       uint32 = 2   /* File operation (open, close...) or file I/O */
	EC_NET        uint32 = 3   /* Network operation (socket, bind...) or network I/O */
	EC_IPC        uint32 = 4   /* IPC operation (pipe, futex...) or IPC I/O (e.g. on a pipe) */
	EC_MEMORY     uint32 = 5   /* Memory-related operation (e.g. brk) */
	EC_PROCESS    uint32 = 6   /* Process-related operation (fork, clone...) */
	EC_SLEEP      uint32 = 7   /* Plain sleep */
	EC_SYSTEM     uint32 = 8   /* System-related operations (e.g. reboot) */
	EC_SIGNAL     uint32 = 9   /* Signal-related operations (e.g. signal) */
	EC_USER       uint32 = 10  /* User-related operations (e.g. getuid) */
	EC_TIME       uint32 = 11  /* Time-related syscalls (e.g. gettimeofday) */
	EC_PROCESSING uint32 = 12  /* User level processing. Never used for system calls */
	EC_IO_BASE    uint32 = 32  /* used for masking */
	EC_IO_READ    uint32 = 32  /* General I/O read (can be file, socket, IPC...) */
	EC_IO_WRITE   uint32 = 33  /* General I/O write (can be file, socket, IPC...) */
	EC_IO_OTHER   uint32 = 34  /* General I/O that is neither read not write (can be file, socket, IPC...) */
	EC_WAIT       uint32 = 64  /* General wait (can be file, socket, IPC...) */
	EC_SCHEDULER  uint32 = 128 /* Scheduler event (e.g. context switch) */
	EC_INTERNAL   uint32 = 256 /* Internal event that shouldn't be shown to the user */
)

// event flags
const (
	EF_NONE             uint32 = 0
	EF_CREATES_FD       uint32 = (1 << 0)  /* This event creates an FD (e.g. open) */
	EF_DESTROYS_FD      uint32 = (1 << 1)  /* This event destroys an FD (e.g. close) */
	EF_USES_FD          uint32 = (1 << 2)  /* This event operates on an FD. */
	EF_READS_FROM_FD    uint32 = (1 << 3)  /* This event reads data from an FD. */
	EF_WRITES_TO_FD     uint32 = (1 << 4)  /* This event writes data to an FD. */
	EF_MODIFIES_STATE   uint32 = (1 << 5)  /* This event causes the machine state to change and should not be dropped by the filtering engine. */
	EF_UNUSED           uint32 = (1 << 6)  /* This event is not used */
	EF_WAITS            uint32 = (1 << 7)  /* This event reads data from an FD. */
	EF_SKIPPARSERESET   uint32 = (1 << 8)  /* This event shouldn't pollute the parser lastevent state tracker. */
	EF_OLD_VERSION      uint32 = (1 << 9)  /* This event is kept for backward compatibility */
	EF_DROP_SIMPLE_CONS uint32 = (1 << 10) /* This event can be skipped by consumers that privilege low overhead to full event capture */
)

// param types
const (
	PT_NONE               uint32 = 0
	PT_INT8               uint32 = 1
	PT_INT16              uint32 = 2
	PT_INT32              uint32 = 3
	PT_INT64              uint32 = 4
	PT_UINT8              uint32 = 5
	PT_UINT16             uint32 = 6
	PT_UINT32             uint32 = 7
	PT_UINT64             uint32 = 8
	PT_CHARBUF            uint32 = 9  /* A printable buffer of bytes, NULL terminated */
	PT_BYTEBUF            uint32 = 10 /* A raw buffer of bytes not suitable for printing */
	PT_ERRNO              uint32 = 11 /* this is an INT64, but will be interpreted as an error code */
	PT_SOCKADDR           uint32 = 12 /* A sockaddr structure, 1byte family + data */
	PT_SOCKTUPLE          uint32 = 13 /* A sockaddr tuple,1byte family + 12byte data + 12byte data */
	PT_FD                 uint32 = 14 /* An fd, 64bit */
	PT_PID                uint32 = 15 /* A pid/tid, 64bit */
	PT_FDLIST             uint32 = 16 /* A list of fds, 16bit count + count * (64bit fd + 16bit flags) */
	PT_FSPATH             uint32 = 17 /* A string containing a relative or absolute file system path, null terminated */
	PT_SYSCALLID          uint32 = 18 /* A 16bit system call ID. Can be used as a key for the g_syscall_info_table table. */
	PT_SIGTYPE            uint32 = 19 /* An 8bit signal number */
	PT_RELTIME            uint32 = 20 /* A relative time. Seconds * 10^9  + nanoseconds. 64bit. */
	PT_ABSTIME            uint32 = 21 /* An absolute time interval. Seconds from epoch * 10^9  + nanoseconds. 64bit. */
	PT_PORT               uint32 = 22 /* A TCP/UDP prt. 2 bytes. */
	PT_L4PROTO            uint32 = 23 /* A 1 byte IP protocol type. */
	PT_SOCKFAMILY         uint32 = 24 /* A 1 byte socket family. */
	PT_BOOL               uint32 = 25 /* A boolean value, 4 bytes. */
	PT_IPV4ADDR           uint32 = 26 /* A 4 byte raw IPv4 address. */
	PT_DYN                uint32 = 27 /* Type can vary depending on the context. Used for filter fields like evt.rawarg. */
	PT_FLAGS8             uint32 = 28 /* this is an UINT8, but will be interpreted as 8 bit flags. */
	PT_FLAGS16            uint32 = 29 /* this is an UINT16, but will be interpreted as 16 bit flags. */
	PT_FLAGS32            uint32 = 30 /* this is an UINT32, but will be interpreted as 32 bit flags. */
	PT_UID                uint32 = 31 /* this is an UINT32, MAX_UINT32 will be interpreted as no value. */
	PT_GID                uint32 = 32 /* this is an UINT32, MAX_UINT32 will be interpreted as no value. */
	PT_DOUBLE             uint32 = 33 /* this is a double precision floating point number. */
	PT_SIGSET             uint32 = 34 /* sigset_t. I only store the lower UINT32 of it */
	PT_CHARBUFARRAY       uint32 = 35 /* Pointer to an array of strings, exported by the user events decoder. 64bit. For internal use only. */
	PT_CHARBUF_PAIR_ARRAY uint32 = 36 /* Pointer to an array of string pairs, exported by the user events decoder. 64bit. For internal use only. */
	PT_IPV4NET            uint32 = 37 /* An IPv4 network. */
	PT_IPV6ADDR           uint32 = 38 /* A 16 byte raw IPv6 address. */
	PT_IPV6NET            uint32 = 39 /* An IPv6 network. */
	PT_IPADDR             uint32 = 40 /* Either an IPv4 or IPv6 address. The length indicates which one it is. */
	PT_IPNET              uint32 = 41 /* Either an IPv4 or IPv6 network. The length indicates which one it is. */
	PT_MODE               uint32 = 42 /* a 32 bit bitmask to represent file modes. */
	PT_FSRELPATH          uint32 = 43 /* A path relative to a dirfd. */
	PT_MAX                uint32 = 44 /* array size */
)

// print format
const (
	PF_NA            uint32 = 0
	PF_DEC           uint32 = 1 /* decimal */
	PF_HEX           uint32 = 2 /* hexadecimal */
	PF_10_PADDED_DEC uint32 = 3 /* decimal padded to 10 digits, useful to print the fractional part of a ns timestamp */
	PF_ID            uint32 = 4
	PF_DIR           uint32 = 5
	PF_OCT           uint32 = 6 /* octal */
)

type PPMNameValue struct {
	name  *[]byte
	value uint32
}

type PPMParamInfo struct {
	Name  [PPM_MAX_NAME_LEN]byte
	Type  uint32
	Fmt   uint32
	Info  [8]uint8
	Ninfo uint8
}

type PPMEventInfo struct {
	Name     [PPM_MAX_NAME_LEN]byte
	Category uint32
	Flags    uint32
	Nparams  uint32
	Params   [PPM_MAX_EVENT_PARAMS]PPMParamInfo
}

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

// EventTable is the Go representation of the event table we load into the
// Falco libs bpf program in order to let it process events
var EventTable = map[uint32]PPMEventInfo{
	// PPME_SYSCALL_CLONE_20_E:  {strToPPMName("clone"), EC_PROCESS, EF_MODIFIES_STATE, 0, [PPM_MAX_EVENT_PARAMS]PPMParamInfo{}},
	// PPME_SYSCALL_CLONE_20_X:  {strToPPMName("clone"), EC_PROCESS, EF_MODIFIES_STATE, 20, [PPM_MAX_EVENT_PARAMS]PPMParamInfo{{strToPPMName("res"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("exe"), PT_CHARBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("args"), PT_BYTEBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("tid"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("pid"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("ptid"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("cwd"), PT_CHARBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("fdlimit"), PT_INT64, PF_DEC, [8]uint8{}, 0}, {strToPPMName("pgft_maj"), PT_UINT64, PF_DEC, [8]uint8{}, 0}, {strToPPMName("pgft_min"), PT_UINT64, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vm_size"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vm_rss"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vm_swap"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("comm"), PT_CHARBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("cgroups"), PT_BYTEBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("flags"), PT_FLAGS32, PF_HEX, &cloneFlags, 0}, {strToPPMName("uid"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("gid"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vtid"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vpid"), PT_PID, PF_DEC, [8]uint8{}, 0}}},
	// PPME_SYSCALL_FORK_E:   {strToPPMName("fork"), EC_PROCESS, EF_MODIFIES_STATE, 0, [PPM_MAX_EVENT_PARAMS]PPMParamInfo{}},
	// PPME_SYSCALL_FORK_X:   {strToPPMName("fork"), EC_PROCESS, EF_MODIFIES_STATE, 20, [PPM_MAX_EVENT_PARAMS]PPMParamInfo{{strToPPMName("res"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("exe"), PT_CHARBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("args"), PT_BYTEBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("tid"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("pid"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("ptid"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("cwd"), PT_CHARBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("fdlimit"), PT_INT64, PF_DEC, [8]uint8{}, 0}, {strToPPMName("pgft_maj"), PT_UINT64, PF_DEC, [8]uint8{}, 0}, {strToPPMName("pgft_min"), PT_UINT64, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vm_size"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vm_rss"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vm_swap"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("comm"), PT_CHARBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("cgroups"), PT_BYTEBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("flags"), PT_FLAGS32, PF_HEX, &cloneFlags, 0}, {strToPPMName("uid"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("gid"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vtid"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vpid"), PT_PID, PF_DEC, [8]uint8{}, 0}}},
	// PPME_SYSCALL_VFORK_E:  {strToPPMName("vfork"), EC_PROCESS, EF_MODIFIES_STATE, 0, [PPM_MAX_EVENT_PARAMS]PPMParamInfo{}},
	// PPME_SYSCALL_VFORK_X:  {strToPPMName("vfork"), EC_PROCESS, EF_MODIFIES_STATE, 20, [PPM_MAX_EVENT_PARAMS]PPMParamInfo{{strToPPMName("res"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("exe"), PT_CHARBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("args"), PT_BYTEBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("tid"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("pid"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("ptid"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("cwd"), PT_CHARBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("fdlimit"), PT_INT64, PF_DEC, [8]uint8{}, 0}, {strToPPMName("pgft_maj"), PT_UINT64, PF_DEC, [8]uint8{}, 0}, {strToPPMName("pgft_min"), PT_UINT64, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vm_size"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vm_rss"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vm_swap"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("comm"), PT_CHARBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("cgroups"), PT_BYTEBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("flags"), PT_FLAGS32, PF_HEX, &cloneFlags, 0}, {strToPPMName("uid"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("gid"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vtid"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vpid"), PT_PID, PF_DEC, [8]uint8{}, 0}}},
	PPME_SYSCALL_EXECVE_19_E: {strToPPMName("execve"), EC_PROCESS, EF_MODIFIES_STATE, 1, [PPM_MAX_EVENT_PARAMS]PPMParamInfo{{strToPPMName("filename"), PT_FSPATH, PF_NA, [8]uint8{}, 0}}},
	PPME_SYSCALL_EXECVE_19_X: {strToPPMName("execve"), EC_PROCESS, EF_MODIFIES_STATE, 19, [PPM_MAX_EVENT_PARAMS]PPMParamInfo{{strToPPMName("res"), PT_ERRNO, PF_DEC, [8]uint8{}, 0}, {strToPPMName("exe"), PT_CHARBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("args"), PT_BYTEBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("tid"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("pid"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("ptid"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("cwd"), PT_CHARBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("fdlimit"), PT_UINT64, PF_DEC, [8]uint8{}, 0}, {strToPPMName("pgft_maj"), PT_UINT64, PF_DEC, [8]uint8{}, 0}, {strToPPMName("pgft_min"), PT_UINT64, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vm_size"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vm_rss"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("vm_swap"), PT_UINT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("comm"), PT_CHARBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("cgroups"), PT_BYTEBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("env"), PT_BYTEBUF, PF_NA, [8]uint8{}, 0}, {strToPPMName("tty"), PT_INT32, PF_DEC, [8]uint8{}, 0}, {strToPPMName("pgid"), PT_PID, PF_DEC, [8]uint8{}, 0}, {strToPPMName("loginuid"), PT_INT32, PF_DEC, [8]uint8{}, 0}}},
}

func strToPPMName(str string) [PPM_MAX_NAME_LEN]byte {
	var ppmName [PPM_MAX_NAME_LEN]byte
	copy(ppmName[:], str)
	return ppmName
}
