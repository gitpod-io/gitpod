// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package seccomp

import (
	"context"
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unsafe"

	"github.com/moby/sys/mountinfo"
	"golang.org/x/sys/unix"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/workspacekit/pkg/readarg"
	daemonapi "github.com/gitpod-io/gitpod/ws-daemon/api"
	libseccomp "github.com/seccomp/libseccomp-golang"
)

type syscallHandler func(req *libseccomp.ScmpNotifReq) (val uint64, errno int32, flags uint32)

// SyscallHandler handles seccomp syscall notifications
type SyscallHandler interface {
	Mount(req *libseccomp.ScmpNotifReq) (val uint64, errno int32, flags uint32)
	Umount(req *libseccomp.ScmpNotifReq) (val uint64, errno int32, flags uint32)
	Bind(req *libseccomp.ScmpNotifReq) (val uint64, errno int32, flags uint32)
}

func mapHandler(h SyscallHandler) map[string]syscallHandler {
	return map[string]syscallHandler{
		"mount":   h.Mount,
		"umount":  h.Umount,
		"umount2": h.Umount,
		"bind":    h.Bind,
	}
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

	// we explicitly prohibit open_tree/move_mount to prevent container workloads
	// from moving a proc mask using open_tree(..., CLONE|RECURSIVE).
	deniedSyscalls := []string{
		"open_tree",
		"move_mount",
	}
	for _, sc := range deniedSyscalls {
		syscallID, err := libseccomp.GetSyscallFromName(sc)
		if err != nil {
			return 0, fmt.Errorf("unknown syscall %s: %w", sc, err)
		}
		err = filter.AddRule(syscallID, libseccomp.ActErrno.SetReturnCode(int16(unix.EPERM)))
		if err != nil {
			return 0, fmt.Errorf("cannot add rule for %s: %w", sc, err)
		}
	}

	handledSyscalls := mapHandler(&InWorkspaceHandler{})
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
func Handle(fd libseccomp.ScmpFd, handler SyscallHandler) (stop chan<- struct{}, errchan <-chan error) {
	ec := make(chan error)
	stp := make(chan struct{})

	handledSyscalls := mapHandler(handler)
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

			syscallName, _ := req.Data.Syscall.GetName()

			handler, ok := handledSyscalls[syscallName]
			if !ok {
				handler = handleUnknownSyscall
			}
			val, errno, flags := handler(req)

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

func handleUnknownSyscall(req *libseccomp.ScmpNotifReq) (val uint64, errno int32, flags uint32) {
	nme, _ := req.Data.Syscall.GetName()
	log.WithField("syscall", nme).Warn("don't know how to handle this syscall")
	return 0, 1, 0
}

func Errno(err unix.Errno) (val uint64, errno int32, flags uint32) {
	return ^uint64(0), int32(errno), 0
}

// InWorkspaceHandler is the seccomp notification handler that serves a Gitpod workspace
type InWorkspaceHandler struct {
	FD          libseccomp.ScmpFd
	Daemon      daemonapi.InWorkspaceServiceClient
	Ring2PID    int
	Ring2Rootfs string
	BindEvents  chan<- BindEvent
}

// BindEvent describes a process binding to a socket
type BindEvent struct {
	PID uint32
}

// Mount handles mount syscalls
func (h *InWorkspaceHandler) Mount(req *libseccomp.ScmpNotifReq) (val uint64, errno int32, flags uint32) {
	log := log.WithFields(map[string]interface{}{
		"syscall": "mount",
		"pid":     req.Pid,
		"id":      req.ID,
	})

	memFile, err := readarg.OpenMem(req.Pid)
	if err != nil {
		log.WithError(err).Error("cannot open mem")
		return Errno(unix.EPERM)
	}
	defer memFile.Close()

	// TODO(cw): find why this breaks
	// err = libseccomp.NotifIDValid(fd, req.ID)
	// if err != nil {
	// 	log.WithError(err).Error("invalid notif ID")
	// 	return Errno(unix.EPERM)
	// }

	source, err := readarg.ReadString(memFile, int64(req.Data.Args[0]))
	if err != nil {
		log.WithField("arg", 0).WithError(err).Error("cannot read argument")
		return Errno(unix.EFAULT)
	}
	dest, err := readarg.ReadString(memFile, int64(req.Data.Args[1]))
	if err != nil {
		log.WithField("arg", 1).WithError(err).Error("cannot read argument")
		return Errno(unix.EFAULT)
	}
	filesystem, err := readarg.ReadString(memFile, int64(req.Data.Args[2]))
	if err != nil {
		log.WithField("arg", 2).WithError(err).Error("cannot read argument")
		return Errno(unix.EFAULT)
	}

	log.WithFields(map[string]interface{}{
		"source": source,
		"dest":   dest,
		"fstype": filesystem,
	}).Info("handling mount syscall")

	if filesystem == "proc" {
		target := filepath.Join(h.Ring2Rootfs, dest)
		stat, err := os.Lstat(target)
		if os.IsNotExist(err) {
			err = os.MkdirAll(target, 0755)
		}
		if err != nil {
			log.WithField("dest", dest).WithError(err).Error("cannot stat mountpoint")
			return Errno(unix.EFAULT)
		} else if stat != nil && stat.Mode()&os.ModeDir == 0 {
			log.WithField("dest", dest).WithError(err).Error("proc must be mounted on an ordinary directory")
			return Errno(unix.EPERM)
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_, err = h.Daemon.MountProc(ctx, &daemonapi.MountProcRequest{
			Target: dest,
			Pid:    int64(req.Pid),
		})
		if err != nil {
			log.WithField("target", target).WithError(err).Error("cannot mount proc")
			return Errno(unix.EFAULT)
		}

		return 0, 0, 0
	}

	// let the kernel do the work
	return 0, 0, libseccomp.NotifRespFlagContinue
}

// Umount handles umount and umount2 syscalls
func (h *InWorkspaceHandler) Umount(req *libseccomp.ScmpNotifReq) (val uint64, errno int32, flags uint32) {
	nme, _ := req.Data.Syscall.GetName()
	log := log.WithFields(map[string]interface{}{
		"syscall": nme,
		"pid":     req.Pid,
		"id":      req.ID,
	})

	memFile, err := readarg.OpenMem(req.Pid)
	if err != nil {
		log.WithError(err).Error("cannot open mem")
		return Errno(unix.EPERM)
	}
	defer memFile.Close()

	target, err := readarg.ReadString(memFile, int64(req.Data.Args[0]))
	if err != nil {
		log.WithField("arg", 0).WithError(err).Error("cannot read argument")
		return Errno(unix.EFAULT)
	}
	target = strings.TrimSuffix(target, "/")

	fd, err := os.Open(fmt.Sprintf("/proc/%d/mountinfo", req.Pid))
	if err != nil {
		log.WithError(err).Error("cannot read mountinfo")
		return Errno(unix.EFAULT)
	}
	defer fd.Close()
	mnts, err := mountinfo.GetMountsFromReader(fd, func(i *mountinfo.Info) (skip bool, stop bool) { return false, false })
	if err != nil {
		log.WithError(err).Error("cannot parse mountinfo")
		return Errno(unix.EFAULT)
	}

	procMounts := make(map[string]struct{})
	for _, mnt := range mnts {
		if mnt.FSType == "proc" {
			procMounts[mnt.Mountpoint] = struct{}{}
		}
	}

	if _, ok := procMounts[target]; ok {
		// ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		// defer cancel()
		// _, err = h.Daemon.UmountProc(ctx, &daemonapi.UmountProcRequest{
		// 	Target: target,
		// 	Pid:    int64(req.Pid),
		// })
		// if err != nil {
		// 	log.WithError(err).Error("cannot umount proc mount")
		// 	return Errno(unix.EFAULT)
		// }

		// log.WithField("target", target).Info("umounted proc mount")
		// return 0, 0, 0

		// proc umounting doesn't work yet from ws-daemon. Instead EPERM here.
		// In most cases that's not a problem because in-workspace proc mounts
		// usually happen within a mount namespace anyways, for which the kernel
		// lazy umounts everything that's just attached within that namespace.
		// TODO(cw): make proc umounting work in ws-dameon.
		return Errno(unix.EPERM)
	}

	var isProcMountChild bool
	for procMount := range procMounts {
		if strings.HasPrefix(target, procMount) {
			isProcMountChild = true
			break
		}
	}
	if isProcMountChild {
		log.WithField("target", target).Warn("user attempted to umount proc mask")
		return Errno(unix.EPERM)
	}

	// let the kernel do the work
	return 0, 0, libseccomp.NotifRespFlagContinue
}

func (h *InWorkspaceHandler) Bind(req *libseccomp.ScmpNotifReq) (val uint64, errno int32, flags uint32) {
	log := log.WithFields(map[string]interface{}{
		"syscall": "bind",
		"pid":     req.Pid,
		"id":      req.ID,
	})
	// We want the syscall to succeed, no matter what we do in this handler.
	// The Kernel will execute the syscall for us.
	defer func() {
		val = 0
		errno = 0
		flags = libseccomp.NotifRespFlagContinue
		return
	}()

	memFile, err := readarg.OpenMem(req.Pid)
	if err != nil {
		log.WithError(err).Error("cannot open mem")
		return
	}
	defer memFile.Close()

	// TODO(cw): find why this breaks
	// err = libseccomp.NotifIDValid(fd, req.ID)
	// if err != nil {
	// 	log.WithError(err).Error("invalid notif ID")
	// 	return returnErrno(unix.EPERM)
	// }

	evt := BindEvent{PID: req.Pid}
	select {
	case h.BindEvents <- evt:
	default:
	}

	// socketFdB, err := readarg.ReadBytes(memFile, int64(req.Data.Args[0]), int(req.Data.Args[1]-req.Data.Args[0]))
	// if err != nil {
	// 	log.WithError(err).Error("cannot read socketfd arg")
	// }

	// socketfd := nativeEndian.Uint64(socketFdB)
	// unix.Getsockname()

	return
}

var nativeEndian binary.ByteOrder

func init() {
	buf := [2]byte{}
	*(*uint16)(unsafe.Pointer(&buf[0])) = uint16(0xABCD)

	switch buf {
	case [2]byte{0xCD, 0xAB}:
		nativeEndian = binary.LittleEndian
	case [2]byte{0xAB, 0xCD}:
		nativeEndian = binary.BigEndian
	default:
		panic("Could not determine native endianness.")
	}
}
