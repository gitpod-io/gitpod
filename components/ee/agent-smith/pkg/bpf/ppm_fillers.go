// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package bpf

type PPMFillerID uint32

const (
	PPM_FILLER_sys_autofill               PPMFillerID = 0
	PPM_FILLER_sys_generic                PPMFillerID = 1
	PPM_FILLER_sys_empty                  PPMFillerID = 2
	PPM_FILLER_sys_single                 PPMFillerID = 3
	PPM_FILLER_sys_single_x               PPMFillerID = 4
	PPM_FILLER_sys_open_x                 PPMFillerID = 5
	PPM_FILLER_sys_read_x                 PPMFillerID = 6
	PPM_FILLER_sys_write_x                PPMFillerID = 7
	PPM_FILLER_sys_execve_e               PPMFillerID = 8
	PPM_FILLER_proc_startupdate           PPMFillerID = 9
	PPM_FILLER_proc_startupdate_2         PPMFillerID = 10
	PPM_FILLER_proc_startupdate_3         PPMFillerID = 11
	PPM_FILLER_sys_socketpair_x           PPMFillerID = 12
	PPM_FILLER_sys_setsockopt_x           PPMFillerID = 13
	PPM_FILLER_sys_getsockopt_x           PPMFillerID = 14
	PPM_FILLER_sys_connect_x              PPMFillerID = 15
	PPM_FILLER_sys_accept4_e              PPMFillerID = 16
	PPM_FILLER_sys_accept_x               PPMFillerID = 17
	PPM_FILLER_sys_send_e                 PPMFillerID = 18
	PPM_FILLER_sys_send_x                 PPMFillerID = 19
	PPM_FILLER_sys_sendto_e               PPMFillerID = 20
	PPM_FILLER_sys_sendmsg_e              PPMFillerID = 21
	PPM_FILLER_sys_sendmsg_x              PPMFillerID = 22
	PPM_FILLER_sys_recv_x                 PPMFillerID = 23
	PPM_FILLER_sys_recvfrom_x             PPMFillerID = 24
	PPM_FILLER_sys_recvmsg_x              PPMFillerID = 25
	PPM_FILLER_sys_recvmsg_x_2            PPMFillerID = 26
	PPM_FILLER_sys_shutdown_e             PPMFillerID = 27
	PPM_FILLER_sys_creat_x                PPMFillerID = 28
	PPM_FILLER_sys_pipe_x                 PPMFillerID = 29
	PPM_FILLER_sys_eventfd_e              PPMFillerID = 30
	PPM_FILLER_sys_futex_e                PPMFillerID = 31
	PPM_FILLER_sys_lseek_e                PPMFillerID = 32
	PPM_FILLER_sys_llseek_e               PPMFillerID = 33
	PPM_FILLER_sys_socket_bind_x          PPMFillerID = 34
	PPM_FILLER_sys_poll_e                 PPMFillerID = 35
	PPM_FILLER_sys_poll_x                 PPMFillerID = 36
	PPM_FILLER_sys_pread64_e              PPMFillerID = 37
	PPM_FILLER_sys_preadv64_e             PPMFillerID = 38
	PPM_FILLER_sys_writev_e               PPMFillerID = 39
	PPM_FILLER_sys_pwrite64_e             PPMFillerID = 40
	PPM_FILLER_sys_readv_preadv_x         PPMFillerID = 41
	PPM_FILLER_sys_writev_pwritev_x       PPMFillerID = 42
	PPM_FILLER_sys_pwritev_e              PPMFillerID = 43
	PPM_FILLER_sys_nanosleep_e            PPMFillerID = 44
	PPM_FILLER_sys_getrlimit_setrlimit_e  PPMFillerID = 45
	PPM_FILLER_sys_getrlimit_setrlrimit_x PPMFillerID = 46
	PPM_FILLER_sys_prlimit_e              PPMFillerID = 47
	PPM_FILLER_sys_prlimit_x              PPMFillerID = 48
	PPM_FILLER_sched_switch_e             PPMFillerID = 49
	PPM_FILLER_sched_drop                 PPMFillerID = 50
	PPM_FILLER_sys_fcntl_e                PPMFillerID = 51
	PPM_FILLER_sys_ptrace_e               PPMFillerID = 52
	PPM_FILLER_sys_ptrace_x               PPMFillerID = 53
	PPM_FILLER_sys_mmap_e                 PPMFillerID = 54
	PPM_FILLER_sys_brk_munmap_mmap_x      PPMFillerID = 55
	PPM_FILLER_sys_renameat_x             PPMFillerID = 56
	PPM_FILLER_sys_renameat2_x            PPMFillerID = 57
	PPM_FILLER_sys_symlinkat_x            PPMFillerID = 58
	PPM_FILLER_sys_procexit_e             PPMFillerID = 59
	PPM_FILLER_sys_sendfile_e             PPMFillerID = 60
	PPM_FILLER_sys_sendfile_x             PPMFillerID = 61
	PPM_FILLER_sys_quotactl_e             PPMFillerID = 62
	PPM_FILLER_sys_quotactl_x             PPMFillerID = 63
	PPM_FILLER_sys_sysdigevent_e          PPMFillerID = 64
	PPM_FILLER_sys_getresuid_and_gid_x    PPMFillerID = 65
	PPM_FILLER_sys_signaldeliver_e        PPMFillerID = 66
	PPM_FILLER_sys_pagefault_e            PPMFillerID = 67
	PPM_FILLER_sys_setns_e                PPMFillerID = 68
	PPM_FILLER_sys_unshare_e              PPMFillerID = 69
	PPM_FILLER_sys_flock_e                PPMFillerID = 70
	PPM_FILLER_cpu_hotplug_e              PPMFillerID = 71
	PPM_FILLER_sys_semop_x                PPMFillerID = 72
	PPM_FILLER_sys_semget_e               PPMFillerID = 73
	PPM_FILLER_sys_semctl_e               PPMFillerID = 74
	PPM_FILLER_sys_ppoll_e                PPMFillerID = 75
	PPM_FILLER_sys_mount_e                PPMFillerID = 76
	PPM_FILLER_sys_access_e               PPMFillerID = 77
	PPM_FILLER_sys_socket_x               PPMFillerID = 78
	PPM_FILLER_sys_bpf_x                  PPMFillerID = 79
	PPM_FILLER_sys_unlinkat_x             PPMFillerID = 80
	PPM_FILLER_sys_fchmodat_x             PPMFillerID = 81
	PPM_FILLER_sys_chmod_x                PPMFillerID = 82
	PPM_FILLER_sys_fchmod_x               PPMFillerID = 83
	PPM_FILLER_sys_mkdirat_x              PPMFillerID = 84
	PPM_FILLER_sys_openat_x               PPMFillerID = 85
	PPM_FILLER_sys_linkat_x               PPMFillerID = 86
	PPM_FILLER_terminate_filler           PPMFillerID = 87
	PPM_FILLER_MAX                        PPMFillerID = 88
)
