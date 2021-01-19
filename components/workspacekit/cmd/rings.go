// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	daemonapi "github.com/gitpod-io/gitpod/ws-daemon/api"

	"github.com/rootless-containers/rootlesskit/pkg/msgutil"
	"github.com/rootless-containers/rootlesskit/pkg/sigproxy"
	sigproxysignal "github.com/rootless-containers/rootlesskit/pkg/sigproxy/signal"
	"github.com/spf13/cobra"
	"golang.org/x/sys/unix"
	"google.golang.org/grpc"
	"kernel.org/pub/linux/libs/security/libcap/cap"
)

const (
	// ring1ShutdownTimeout is the time ring1 gets between SIGTERM and SIGKILL.
	// We do this to ensure we have enough time left for ring0 to clean up prior
	// to receiving SIGKILL from the kubelet.
	//
	// This time must give ring1 enough time to shut down (see time budgets in supervisor.go),
	// and to talk to ws-daemon within the terminationGracePeriod of the workspace pod.
	ring1ShutdownTimeout = 20 * time.Second
)

var ring0Cmd = &cobra.Command{
	Use:   "ring0",
	Short: "starts ring0 - enter here",
	Run: func(_ *cobra.Command, args []string) {
		log.Init(ServiceName, Version, true, true)
		log := log.WithField("ring", 0)

		var failed bool
		defer func() {
			if !failed {
				return
			}
			sleepForDebugging()
		}()

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		client, conn, err := connectToInWorkspaceDaemonService(ctx)
		if err != nil {
			log.WithError(err).Error("cannot connect to daemon")
			return
		}
		defer conn.Close()

		_, err = client.PrepareForUserNS(ctx, &daemonapi.PrepareForUserNSRequest{})
		if err != nil {
			log.WithError(err).Fatal("cannot prepare for user namespaces")
			return
		}
		defer func() {
			ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			_, err = client.Teardown(ctx, &daemonapi.TeardownRequest{})
			if err != nil {
				log.WithError(err).Error("cannot trigger teardown")
				failed = true
				return
			}
		}()

		cmd := exec.Command("/proc/self/exe", "ring1")
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Pdeathsig:  syscall.SIGKILL,
			Cloneflags: syscall.CLONE_NEWUSER | syscall.CLONE_NEWNS,
		}
		cmd.Stdin = os.Stdin
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Env = os.Environ()

		if err := cmd.Start(); err != nil {
			log.WithError(err).Error("failed to start ring0")
			failed = true
			return
		}

		sigc := make(chan os.Signal, 128)
		signal.Notify(sigc)
		go func() {
			defer func() {
				// This is a 'just in case' fallback, in case we're racing the cmd.Process and it's become
				// nil in the time since we checked.
				err := recover()
				if err != nil {
					log.WithField("recovered", err).Error("recovered from panic")
				}
			}()

			for {
				sig := <-sigc
				if sig != unix.SIGTERM {
					cmd.Process.Signal(sig)
					continue
				}

				cmd.Process.Signal(unix.SIGTERM)
				time.Sleep(ring1ShutdownTimeout)
				if cmd.Process == nil {
					return
				}

				log.Warn("ring1 did not shut down in time - sending sigkill")
				err = cmd.Process.Kill()
				if err != nil {
					log.WithError(err).Error("cannot kill ring1")
				}
				return
			}
		}()

		err = cmd.Wait()
		if eerr, ok := err.(*exec.ExitError); ok {
			state, ok := eerr.ProcessState.Sys().(syscall.WaitStatus)
			if ok && state.Signal() == syscall.SIGKILL {
				log.Warn("ring1 was killed")
				return
			}
		}
		if err != nil {
			log.WithError(err).Error("unexpected exit")
			failed = true
			return
		}
	},
}

var ring1Opts struct {
	MappingEstablished bool
}
var ring1Cmd = &cobra.Command{
	Use:   "ring1",
	Short: "starts ring1",
	Run: func(_cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, true, true)
		log := log.WithField("ring", 1)
		defer log.Info("done")

		var failed bool
		defer func() {
			if !failed {
				return
			}
			sleepForDebugging()
		}()

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		client, conn, err := connectToInWorkspaceDaemonService(ctx)
		if err != nil {
			log.WithError(err).Error("cannot connect to daemon")
			failed = true
			return
		}
		defer conn.Close()

		if !ring1Opts.MappingEstablished {
			mapping := []*daemonapi.WriteIDMappingRequest_Mapping{
				{ContainerId: 0, HostId: 33333, Size: 1},
				{ContainerId: 1, HostId: 100000, Size: 65534},
			}
			_, err = client.WriteIDMapping(ctx, &daemonapi.WriteIDMappingRequest{Pid: int64(os.Getpid()), Gid: false, Mapping: mapping})
			if err != nil {
				log.WithError(err).Error("cannot establish UID mapping")
				failed = true
				return
			}
			_, err = client.WriteIDMapping(ctx, &daemonapi.WriteIDMappingRequest{Pid: int64(os.Getpid()), Gid: true, Mapping: mapping})
			if err != nil {
				log.WithError(err).Error("cannot establish GID mapping")
				failed = true
				return
			}
			err = syscall.Exec("/proc/self/exe", append(os.Args, "--mapping-established"), os.Environ())
			if err != nil {
				log.WithError(err).Error("cannot exec /proc/self/exe")
				failed = true
				return
			}
			return
		}

		// The parent calls child with Pdeathsig, but it is cleared when the UID/GID mapping is written.
		// (see also https://github.com/rootless-containers/rootlesskit/issues/65#issuecomment-492343646).
		//
		// (cw) I have been able to reproduce this issue without newuidmap/newgidmap.
		//      See https://gist.github.com/csweichel/3fc9d4b0752367d4a436f969c8685c06
		runtime.LockOSThread()
		unix.Prctl(unix.PR_SET_PDEATHSIG, uintptr(unix.SIGKILL), 0, 0, 0)
		runtime.UnlockOSThread()

		tmpdir, err := ioutil.TempDir("", "supervisor")
		if err != nil {
			log.WithError(err).Fatal("cannot create tempdir")
		}

		mnts := []struct {
			Target string
			Source string
			FSType string
			Flags  uintptr
		}{
			// TODO(cw): pull mark mount location from config
			{Target: "/", Source: "/.workspace/mark", FSType: "shiftfs"},
			{Target: "/sys", Flags: unix.MS_BIND | unix.MS_REC},
			{Target: "/dev", Flags: unix.MS_BIND | unix.MS_REC},
			// TODO(cw): only mount /theia if it's in the mount table, i.e. this isn't a registry-facade workspace
			{Target: "/theia", Flags: unix.MS_BIND | unix.MS_REC},
			// TODO(cw): only mount /workspace if it's in the mount table, i.e. this isn't an FWB workspace
			{Target: "/workspace", Flags: unix.MS_BIND | unix.MS_REC},
			{Target: "/etc/hosts", Flags: unix.MS_BIND | unix.MS_REC},
			{Target: "/etc/hostname", Flags: unix.MS_BIND | unix.MS_REC},
			{Target: "/etc/resolv.conf", Flags: unix.MS_BIND | unix.MS_REC},
			{Target: "/tmp", Source: "tmpfs", FSType: "tmpfs"},
		}
		for _, m := range mnts {
			dst := filepath.Join(tmpdir, m.Target)
			_ = os.MkdirAll(dst, 0644)

			if m.Source == "" {
				m.Source = m.Target
			}
			if m.FSType == "" {
				m.FSType = "none"
			}

			log.WithFields(map[string]interface{}{
				"source": m.Source,
				"target": dst,
				"fstype": m.FSType,
				"flags":  m.Flags,
			}).Debug("mounting new rootfs")
			err = unix.Mount(m.Source, dst, m.FSType, m.Flags, "")
			if err != nil {
				log.WithError(err).WithField("dest", dst).Error("cannot establish mount")
				failed = true
				return
			}
		}

		pipeR, pipeW, err := os.Pipe()
		if err != nil {
			log.WithError(err).Error("cannot mount create pipe")
			failed = true
			return
		}
		defer pipeW.Close()

		cmd := exec.Command("/proc/self/exe", "ring2")
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Pdeathsig:  syscall.SIGKILL,
			Cloneflags: syscall.CLONE_NEWNS | syscall.CLONE_NEWPID,
		}
		cmd.ExtraFiles = []*os.File{pipeR}
		cmd.Dir = tmpdir
		cmd.Stdin = os.Stdin
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Env = os.Environ()
		if err := cmd.Start(); err != nil {
			log.WithError(err).Error("failed to start the child process")
			failed = true
			return
		}
		sigc := sigproxy.ForwardAllSignals(context.Background(), cmd.Process.Pid)
		defer sigproxysignal.StopCatch(sigc)

		procLoc := filepath.Join(tmpdir, "proc")
		err = os.MkdirAll(procLoc, 0755)
		if err != nil {
			log.WithError(err).Error("cannot mount proc")
			failed = true
			return
		}
		_, err = client.MountProc(ctx, &daemonapi.MountProcRequest{
			Target: procLoc,
			Pid:    int64(cmd.Process.Pid),
		})
		if err != nil {
			log.WithError(err).Error("cannot mount proc")
			failed = true
			return
		}

		log.Info("signaling to child process")
		_, err = msgutil.MarshalToWriter(pipeW, ringSyncMsg{
			Stage:  1,
			Rootfs: tmpdir,
		})
		if err != nil {
			log.WithError(err).Error("cannot send signal to child process")
			failed = true
			return
		}

		err = cmd.Wait()
		if err != nil {
			log.WithError(err).Error("unexpected exit")
			failed = true
			return
		}
	},
}

var ring2Opts struct {
	SupervisorPath string
}
var ring2Cmd = &cobra.Command{
	Use:   "ring2",
	Short: "starts ring2",
	Run: func(_cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, true, true)
		log := log.WithField("ring", 2)
		defer log.Info("done")

		var failed bool
		defer func() {
			if !failed {
				return
			}
			sleepForDebugging()
		}()

		// wait for /proc by listening on the parent's pipe.
		// fd=3 is the pipe's FD passed in from the parent via extraFiles.
		pipeR := os.NewFile(uintptr(3), "")
		var msg ringSyncMsg
		_, err := msgutil.UnmarshalFromReader(pipeR, &msg)
		if err != nil {
			log.WithError(err).Error("cannot read from parent pipe")
			failed = true
			return
		}
		if msg.Stage != 1 {
			log.WithError(err).WithField("msg", fmt.Sprintf("%+q", msg)).Error("expected stage 1 sync message")
			failed = true
			return
		}

		err = pivotRoot(msg.Rootfs)
		if err != nil {
			log.WithError(err).Error("cannot pivot root")
			failed = true
			return
		}

		err = cap.SetGroups(33333)
		if err != nil {
			log.WithError(err).Error("cannot setgid")
			failed = true
			return
		}
		err = cap.SetUID(33333)
		if err != nil {
			log.WithError(err).Error("cannot setuid")
			failed = true
			return
		}
		err = unix.Exec(ring2Opts.SupervisorPath, []string{"supervisor", "run", "--inns"}, os.Environ())
		if err != nil {
			log.WithError(err).Error("cannot exec")
			failed = true
			return
		}
	},
}

// pivotRoot will call pivot_root such that rootfs becomes the new root
// filesystem, and everything else is cleaned up.
//
// copied from runc: https://github.com/opencontainers/runc/blob/cf6c074115d00c932ef01dedb3e13ba8b8f964c3/libcontainer/rootfs_linux.go#L760
func pivotRoot(rootfs string) error {
	// While the documentation may claim otherwise, pivot_root(".", ".") is
	// actually valid. What this results in is / being the new root but
	// /proc/self/cwd being the old root. Since we can play around with the cwd
	// with pivot_root this allows us to pivot without creating directories in
	// the rootfs. Shout-outs to the LXC developers for giving us this idea.

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
		return fmt.Errorf("pivot_root %s", err)
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
		return fmt.Errorf("chdir / %s", err)
	}
	return nil
}

func sleepForDebugging() {
	log.Info("sleeping five minutes to allow debugging")
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	select {
	case <-sigChan:
	case <-time.After(5 * time.Minute):
	}
	os.Exit(1)
}

type ringSyncMsg struct {
	Stage  int    `json:"stage"`
	Rootfs string `json:"rootfs"`
}

// ConnectToInWorkspaceDaemonService attempts to connect to the InWorkspaceService offered by the ws-daemon.
func connectToInWorkspaceDaemonService(ctx context.Context) (daemonapi.InWorkspaceServiceClient, *grpc.ClientConn, error) {
	const socketFN = "/.workspace/daemon.sock"

	t := time.NewTicker(500 * time.Millisecond)
	defer t.Stop()
	for {
		if _, err := os.Stat(socketFN); err == nil {
			break
		}

		select {
		case <-t.C:
			continue
		case <-ctx.Done():
			return nil, nil, fmt.Errorf("socket did not appear before context was canceled")
		}
	}

	conn, err := grpc.DialContext(ctx, "unix://"+socketFN, grpc.WithInsecure())
	if err != nil {
		return nil, nil, err
	}
	return daemonapi.NewInWorkspaceServiceClient(conn), conn, nil
}

func init() {
	rootCmd.AddCommand(ring0Cmd)
	rootCmd.AddCommand(ring1Cmd)
	rootCmd.AddCommand(ring2Cmd)

	supervisorPath := os.Getenv("GITPOD_WORKSPACEKIT_SUPERVISOR_PATH")
	if supervisorPath == "" {
		wd, err := os.Getwd()
		if err == nil {
			supervisorPath = "supervisor"
		} else {
			supervisorPath = filepath.Join(wd, "supervisor")
		}
	}

	ring1Cmd.Flags().BoolVar(&ring1Opts.MappingEstablished, "mapping-established", false, "true if the UID/GID mapping has already been established")
	ring2Cmd.Flags().StringVar(&ring2Opts.SupervisorPath, "supervisor-path", supervisorPath, "path to the supervisor binary (taken from $GITPOD_WORKSPACEKIT_SUPERVISOR_PATH, defaults to '$PWD/supervisor')")
}
