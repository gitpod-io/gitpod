// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package bpf

import (
	"fmt"
)

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

type PPMEventInfo struct {
	Name     [PPM_MAX_NAME_LEN]byte
	Category uint32
	Flags    uint32
	Nparams  uint32
	Params   [PPM_MAX_EVENT_PARAMS]PPMParamInfo
}

func makePPMEventInfo(name string, cat uint32, flags uint32, nparams uint32, params ...PPMParamInfo) PPMEventInfo {
	ei := PPMEventInfo{
		Name:     strToPPMName(name),
		Category: cat,
		Flags:    flags,
		Nparams:  nparams,
	}
	if len(params) > 0 {
		if len(params) > int(PPM_MAX_EVENT_PARAMS) {
			panic(fmt.Errorf("maximum %d syscall parameters", PPM_MAX_EVENT_PARAMS))
		}
		copy(ei.Params[:], params)
	}

	return ei
}

var (
	fdParam       = makePPMParamInfo("fd", PT_FD, PF_DEC)
	resParam      = makePPMParamInfo("res", PT_ERRNO, PF_DEC)
	tupleParam    = makePPMParamInfo("tuple", PT_UINT32, PF_DEC)
	filenameParam = makePPMParamInfo("filename", PT_FSPATH, PF_NA)
	exeParam      = makePPMParamInfo("exe", PT_CHARBUF, PF_NA)
	argsParam     = makePPMParamInfo("args", PT_BYTEBUF, PF_NA)
	tidParam      = makePPMParamInfo("tid", PT_PID, PF_DEC)
	pidParam      = makePPMParamInfo("pid", PT_PID, PF_DEC)
	ptidParam     = makePPMParamInfo("ptid", PT_PID, PF_DEC)
	cwdParam      = makePPMParamInfo("cwd", PT_CHARBUF, PF_NA)
	fdlimitParam  = makePPMParamInfo("fdlimit", PT_UINT64, PF_DEC)
	pgftMajParam  = makePPMParamInfo("pgft_maj", PT_UINT64, PF_DEC)
	pgftMinParam  = makePPMParamInfo("pgft_min", PT_UINT64, PF_DEC)
	vmSizeParam   = makePPMParamInfo("vm_size", PT_UINT32, PF_DEC)
	vmRssParam    = makePPMParamInfo("vm_rss", PT_UINT32, PF_DEC)
	vmSwapParam   = makePPMParamInfo("vm_swap", PT_UINT32, PF_DEC)
	commParam     = makePPMParamInfo("comm", PT_CHARBUF, PF_NA)
	cgroupsParam  = makePPMParamInfo("cgroups", PT_BYTEBUF, PF_NA)
	envParam      = makePPMParamInfo("env", PT_BYTEBUF, PF_NA)
	ttyParam      = makePPMParamInfo("tty", PT_INT32, PF_DEC)
	pgidParam     = makePPMParamInfo("pgid", PT_PID, PF_DEC)
	loginuidParam = makePPMParamInfo("loginuid", PT_INT32, PF_DEC)
)

// EventTable is the Go representation of the event table we load into the
// Falco libs bpf program in order to let it process events
var EventTable = map[PPMEEventType]PPMEventInfo{

	PPME_SOCKET_CONNECT_E: makePPMEventInfo("connect", EC_NET, EF_USES_FD|EF_MODIFIES_STATE, 1, fdParam),
	PPME_SOCKET_CONNECT_X: makePPMEventInfo("connect", EC_NET, EF_USES_FD|EF_MODIFIES_STATE, 2, resParam, tupleParam),

	PPME_SYSCALL_EXECVE_19_E: makePPMEventInfo("execve", EC_PROCESS, EF_MODIFIES_STATE, 1, filenameParam),
	PPME_SYSCALL_EXECVE_19_X: makePPMEventInfo("execve", EC_PROCESS, EF_MODIFIES_STATE, 19, resParam, exeParam, argsParam, tidParam, pidParam, ptidParam, cwdParam, fdlimitParam, pgftMajParam, pgftMinParam, vmSizeParam, vmRssParam, vmSwapParam, commParam, cgroupsParam, envParam, ttyParam, pgidParam, loginuidParam),
}
