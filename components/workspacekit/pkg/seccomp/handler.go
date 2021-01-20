// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package seccomp

import (
	"fmt"

	"github.com/gitpod-io/gitpod/common-go/log"
	daemonapi "github.com/gitpod-io/gitpod/ws-daemon/api"
	"golang.org/x/sys/unix"

	libseccomp "github.com/seccomp/libseccomp-golang"
)

type syscallHandler func(req *libseccomp.ScmpNotifReq, daemon daemonapi.InWorkspaceServiceClient) (val uint64, errno int32, cont bool)

var handledSyscalls = map[string]syscallHandler{
	"mount": handleMount,
}

// LoadFilter loads the syscall filter required to make the handler work.
// Calling this function has a range of side-effects:
//   - we'll lock the caller using `runtime.LockOSThread()`
//   - we'll set no_new_privs on the process
func LoadFilter() (libseccomp.ScmpFd, error) {
	filter, err := libseccomp.NewFilter(libseccomp.ActAllow)
	if err != nil {
		return 0, fmt.Errorf("cannot create filter: %w", err)
	}
	err = filter.SetTsync(false)
	if err != nil {
		return 0, fmt.Errorf("cannot set tsync: %w", err)
	}
	err = filter.SetNoNewPrivsBit(false)
	if err != nil {
		return 0, fmt.Errorf("cannot set no_new_privs: %w", err)
	}

	for sc := range handledSyscalls {
		syscallID, err := libseccomp.GetSyscallFromName(sc)
		if err != nil {
			return 0, fmt.Errorf("unknown syscall %s: %w", sc, err)
		}
		err = filter.AddRule(syscallID, libseccomp.ActNotify)
		if err != nil {
			return 0, fmt.Errorf("cannot add rule for %s: %w", sc, err)
		}
	}

	err = filter.Load()
	if err != nil {
		return 0, fmt.Errorf("cannot load filter: %w", err)
	}

	fd, err := filter.GetNotifFd()
	if err != nil {
		return 0, fmt.Errorf("cannot get inotif fd: %w", err)
	}

	return fd, nil
}

// Handle actually listens on the seccomp notif FD and handles incoming requests.
// This function returns when the notif FD is closed.
func Handle(fd libseccomp.ScmpFd, targetPID int, daemon daemonapi.InWorkspaceServiceClient) (stop chan<- struct{}, errchan <-chan error) {
	ec := make(chan error)
	stp := make(chan struct{})

	go func() {
		for {
			req, err := libseccomp.NotifReceive(fd)
			select {
			case <-stp:
				// if we're asked stop we might still have to answer a syscall.
				// We do this on a best effort basis answering with EPERM.
				if err != nil {
					libseccomp.NotifRespond(fd, &libseccomp.ScmpNotifResp{
						ID:    req.ID,
						Error: 1,
						Val:   0,
						Flags: 0,
					})
				}
			default:
			}
			if err != nil {
				ec <- err
				if err == unix.ECANCELED {
					return
				}

				continue
			}

			// TODO(cw): figure out why this breaks
			// if err := libseccomp.NotifIDValid(fd, req.ID); err != nil {
			// 	ec <- fmt.Errorf("NotifIDValid: %w", err)
			// 	continue
			// }

			syscallName, _ := req.Data.Syscall.GetName()

			var (
				errno int32
				val   uint64
				cont  bool
			)
			handler, ok := handledSyscalls[syscallName]
			if !ok {
				handler = handleUnknownSyscall
			}
			val, errno, cont = handler(req, daemon)

			var flags uint32
			if cont {
				flags = libseccomp.NotifRespFlagContinue
			}
			err = libseccomp.NotifRespond(fd, &libseccomp.ScmpNotifResp{
				ID:    req.ID,
				Error: errno,
				Val:   val,
				Flags: flags,
			})
			if err != nil {
				ec <- err
			}
		}
	}()

	return stp, ec
}

func handleUnknownSyscall(req *libseccomp.ScmpNotifReq, _ daemonapi.InWorkspaceServiceClient) (val uint64, errno int32, cont bool) {
	nme, _ := req.Data.Syscall.GetName()
	log.WithField("syscall", nme).Warn("don't know how to handle this syscall")
	return 0, 1, false
}

func returnErrno(err unix.Errno) (val uint64, errno int32, cont bool) {
	return ^uint64(0), int32(errno), false
}

func returnSuccess() (val uint64, errno int32, cont bool) {
	return 0, 0, true
}
