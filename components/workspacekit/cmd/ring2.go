// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"net"
	"os"
	"os/exec"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/workspacekit/pkg/seccomp"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/rootless-containers/rootlesskit/pkg/msgutil"
	"github.com/spf13/cobra"
	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"
)

var ring2Opts struct {
	SupervisorPath string
}
var ring2Cmd = &cobra.Command{
	Use:   "ring2 <ring1Socket>",
	Short: "starts ring2",
	Args:  cobra.ExactArgs(1),
	Run: func(_cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, true, false)
		log := log.WithField("ring", 2)

		common_grpc.SetupLogging()

		exitCode := 1
		defer handleExit(&exitCode)

		defer log.Info("done")

		// we talk to ring1 using a Unix socket, so that we can send the seccomp fd across.
		rconn, err := net.Dial("unix", args[0])
		if err != nil {
			log.WithError(err).Error("cannot connect to parent")
			return
		}
		conn := rconn.(*net.UnixConn)
		defer conn.Close()

		log.Info("connected to parent socket")

		// Before we do anything, we wait for the parent to make /proc available to us.
		var msg ringSyncMsg
		_, err = msgutil.UnmarshalFromReader(conn, &msg)
		if err != nil {
			log.WithError(err).Error("cannot read parent message")
			return
		}
		if msg.Stage != 1 {
			log.WithError(err).WithField("msg", fmt.Sprintf("%+q", msg)).Error("expected stage 1 sync message")
			return
		}

		err = pivotRoot(msg.Rootfs, msg.FSShift)
		if err != nil {
			log.WithError(err).Error("cannot pivot root")
			return
		}

		// Now that we're in our new root filesystem, including proc and all, we can load
		// our seccomp filter, and tell our parent about it.
		scmpFd, err := seccomp.LoadFilter()
		if err != nil {
			log.WithError(err).Error("cannot load seccomp filter - syscall handling would be broken")
			return
		}
		connf, err := conn.File()
		if err != nil {
			log.WithError(err).Error("cannot get parent socket fd")
			return
		}
		defer connf.Close()

		sktfd := int(connf.Fd())
		err = unix.Sendmsg(sktfd, nil, unix.UnixRights(int(scmpFd)), nil, 0)
		if err != nil {
			log.WithError(err).Error("cannot send seccomp fd")
			return
		}

		err = unix.Exec(ring2Opts.SupervisorPath, []string{"supervisor", "run"}, os.Environ())
		if err != nil {
			if eerr, ok := err.(*exec.ExitError); ok {
				exitCode = eerr.ExitCode()
			}
			log.WithError(err).WithField("cmd", ring2Opts.SupervisorPath).Error("cannot exec")
			return
		}
		exitCode = 0 // once we get here everythings good
	},
}

// pivotRoot will call pivot_root such that rootfs becomes the new root
// filesystem, and everything else is cleaned up.
//
// copied from runc: https://github.com/opencontainers/runc/blob/cf6c074115d00c932ef01dedb3e13ba8b8f964c3/libcontainer/rootfs_linux.go#L760
func pivotRoot(rootfs string, fsshift api.FSShiftMethod) error {
	// While the documentation may claim otherwise, pivot_root(".", ".") is
	// actually valid. What this results in is / being the new root but
	// /proc/self/cwd being the old root. Since we can play around with the cwd
	// with pivot_root this allows us to pivot without creating directories in
	// the rootfs. Shout-outs to the LXC developers for giving us this idea.

	if fsshift == api.FSShiftMethod_FUSE {
		err := unix.Chroot(rootfs)
		if err != nil {
			return xerrors.Errorf("cannot chroot: %v", err)
		}

		err = unix.Chdir("/")
		if err != nil {
			return xerrors.Errorf("cannot chdir to new root :%v", err)
		}

		return nil
	}

	oldroot, err := unix.Open("/", unix.O_DIRECTORY|unix.O_RDONLY, 0)
	if err != nil {
		return err
	}
	defer unix.Close(oldroot)

	newroot, err := unix.Open(rootfs, unix.O_DIRECTORY|unix.O_RDONLY, 0)
	if err != nil {
		return err
	}
	defer unix.Close(newroot)

	// Change to the new root so that the pivot_root actually acts on it.
	if err := unix.Fchdir(newroot); err != nil {
		return err
	}

	if err := unix.PivotRoot(".", "."); err != nil {
		return xerrors.Errorf("pivot_root %s", err)
	}

	// Currently our "." is oldroot (according to the current kernel code).
	// However, purely for safety, we will fchdir(oldroot) since there isn't
	// really any guarantee from the kernel what /proc/self/cwd will be after a
	// pivot_root(2).

	if err := unix.Fchdir(oldroot); err != nil {
		return err
	}

	// Make oldroot rslave to make sure our unmounts don't propagate to the
	// host (and thus bork the machine). We don't use rprivate because this is
	// known to cause issues due to races where we still have a reference to a
	// mount while a process in the host namespace are trying to operate on
	// something they think has no mounts (devicemapper in particular).
	if err := unix.Mount("", ".", "", unix.MS_SLAVE|unix.MS_REC, ""); err != nil {
		return err
	}
	// Preform the unmount. MNT_DETACH allows us to unmount /proc/self/cwd.
	if err := unix.Unmount(".", unix.MNT_DETACH); err != nil {
		return err
	}

	// Switch back to our shiny new root.
	if err := unix.Chdir("/"); err != nil {
		return xerrors.Errorf("chdir / %s", err)
	}

	return nil
}
