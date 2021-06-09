// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package bpf

type ppm_filler_id int32

const (
	PPM_FILLER_sys_autofill               ppm_filler_id = 0
	PPM_FILLER_sys_generic                              = 1
	PPM_FILLER_sys_empty                                = 2
	PPM_FILLER_sys_single                               = 3
	PPM_FILLER_sys_single_x                             = 4
	PPM_FILLER_sys_open_x                               = 5
	PPM_FILLER_sys_read_x                               = 6
	PPM_FILLER_sys_write_x                              = 7
	PPM_FILLER_sys_execve_e                             = 8
	PPM_FILLER_proc_startupdate                         = 9
	PPM_FILLER_proc_startupdate_2                       = 10
	PPM_FILLER_proc_startupdate_3                       = 11
	PPM_FILLER_sys_socketpair_x                         = 12
	PPM_FILLER_sys_setsockopt_x                         = 13
	PPM_FILLER_sys_getsockopt_x                         = 14
	PPM_FILLER_sys_connect_x                            = 15
	PPM_FILLER_sys_accept4_e                            = 16
	PPM_FILLER_sys_accept_x                             = 17
	PPM_FILLER_sys_send_e                               = 18
	PPM_FILLER_sys_send_x                               = 19
	PPM_FILLER_sys_sendto_e                             = 20
	PPM_FILLER_sys_sendmsg_e                            = 21
	PPM_FILLER_sys_sendmsg_x                            = 22
	PPM_FILLER_sys_recv_x                               = 23
	PPM_FILLER_sys_recvfrom_x                           = 24
	PPM_FILLER_sys_recvmsg_x                            = 25
	PPM_FILLER_sys_recvmsg_x_2                          = 26
	PPM_FILLER_sys_shutdown_e                           = 27
	PPM_FILLER_sys_creat_x                              = 28
	PPM_FILLER_sys_pipe_x                               = 29
	PPM_FILLER_sys_eventfd_e                            = 30
	PPM_FILLER_sys_futex_e                              = 31
	PPM_FILLER_sys_lseek_e                              = 32
	PPM_FILLER_sys_llseek_e                             = 33
	PPM_FILLER_sys_socket_bind_x                        = 34
	PPM_FILLER_sys_poll_e                               = 35
	PPM_FILLER_sys_poll_x                               = 36
	PPM_FILLER_sys_pread64_e                            = 37
	PPM_FILLER_sys_preadv64_e                           = 38
	PPM_FILLER_sys_writev_e                             = 39
	PPM_FILLER_sys_pwrite64_e                           = 40
	PPM_FILLER_sys_readv_preadv_x                       = 41
	PPM_FILLER_sys_writev_pwritev_x                     = 42
	PPM_FILLER_sys_pwritev_e                            = 43
	PPM_FILLER_sys_nanosleep_e                          = 44
	PPM_FILLER_sys_getrlimit_setrlimit_e                = 45
	PPM_FILLER_sys_getrlimit_setrlrimit_x               = 46
	PPM_FILLER_sys_prlimit_e                            = 47
	PPM_FILLER_sys_prlimit_x                            = 48
	PPM_FILLER_sched_switch_e                           = 49
	PPM_FILLER_sched_drop                               = 50
	PPM_FILLER_sys_fcntl_e                              = 51
	PPM_FILLER_sys_ptrace_e                             = 52
	PPM_FILLER_sys_ptrace_x                             = 53
	PPM_FILLER_sys_mmap_e                               = 54
	PPM_FILLER_sys_brk_munmap_mmap_x                    = 55
	PPM_FILLER_sys_renameat_x                           = 56
	PPM_FILLER_sys_renameat2_x                          = 57
	PPM_FILLER_sys_symlinkat_x                          = 58
	PPM_FILLER_sys_procexit_e                           = 59
	PPM_FILLER_sys_sendfile_e                           = 60
	PPM_FILLER_sys_sendfile_x                           = 61
	PPM_FILLER_sys_quotactl_e                           = 62
	PPM_FILLER_sys_quotactl_x                           = 63
	PPM_FILLER_sys_sysdigevent_e                        = 64
	PPM_FILLER_sys_getresuid_and_gid_x                  = 65
	PPM_FILLER_sys_signaldeliver_e                      = 66
	PPM_FILLER_sys_pagefault_e                          = 67
	PPM_FILLER_sys_setns_e                              = 68
	PPM_FILLER_sys_unshare_e                            = 69
	PPM_FILLER_sys_flock_e                              = 70
	PPM_FILLER_cpu_hotplug_e                            = 71
	PPM_FILLER_sys_semop_x                              = 72
	PPM_FILLER_sys_semget_e                             = 73
	PPM_FILLER_sys_semctl_e                             = 74
	PPM_FILLER_sys_ppoll_e                              = 75
	PPM_FILLER_sys_mount_e                              = 76
	PPM_FILLER_sys_access_e                             = 77
	PPM_FILLER_sys_socket_x                             = 78
	PPM_FILLER_sys_bpf_x                                = 79
	PPM_FILLER_sys_unlinkat_x                           = 80
	PPM_FILLER_sys_fchmodat_x                           = 81
	PPM_FILLER_sys_chmod_x                              = 82
	PPM_FILLER_sys_fchmod_x                             = 83
	PPM_FILLER_sys_mkdirat_x                            = 84
	PPM_FILLER_sys_openat_x                             = 85
	PPM_FILLER_sys_linkat_x                             = 86
	PPM_FILLER_terminate_filler                         = 87
	PPM_FILLER_MAX                                      = 88
)
