// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/rootless-containers/rootlesskit/pkg/msgutil"
	"github.com/rootless-containers/rootlesskit/pkg/sigproxy"
	sigproxysignal "github.com/rootless-containers/rootlesskit/pkg/sigproxy/signal"
	libseccomp "github.com/seccomp/libseccomp-golang"
	"github.com/spf13/cobra"
	"golang.org/x/sys/unix"
	"google.golang.org/grpc"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/workspacekit/pkg/lift"
	"github.com/gitpod-io/gitpod/workspacekit/pkg/seccomp"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
	daemonapi "github.com/gitpod-io/gitpod/ws-daemon/api"
)

const (
	// ring1ShutdownTimeout is the time ring1 gets between SIGTERM and SIGKILL.
	// We do this to ensure we have enough time left for ring0 to clean up prior
	// to receiving SIGKILL from the kubelet.
	//
	// This time must give ring1 enough time to shut down (see time budgets in supervisor.go),
	// and to talk to ws-daemon within the terminationGracePeriod of the workspace pod.
	ring1ShutdownTimeout = 20 * time.Second

	// ring2StartupTimeout is the maximum time we wait between starting ring2 and its
	// attempt to connect to the parent socket.
	ring2StartupTimeout = 5 * time.Second
)

var ring0Cmd = &cobra.Command{
	Use:   "ring0",
	Short: "starts ring0 - enter here",
	Run: func(_ *cobra.Command, args []string) {
		log.Init(ServiceName, Version, true, true)
		log := log.WithField("ring", 0)

		exitCode := 1
		defer handleExit(&exitCode)

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		client, conn, err := connectToInWorkspaceDaemonService(ctx)
		if err != nil {
			log.WithError(err).Error("cannot connect to daemon")
			return
		}
		defer conn.Close()

		prep, err := client.PrepareForUserNS(ctx, &daemonapi.PrepareForUserNSRequest{})
		if err != nil {
			log.WithError(err).Fatal("cannot prepare for user namespaces")
			return
		}
		defer func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			_, err = client.Teardown(ctx, &daemonapi.TeardownRequest{})
			if err != nil {
				log.WithError(err).Error("cannot trigger teardown")
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
		cmd.Env = append(os.Environ(),
			"WORKSPACEKIT_FSSHIFT="+prep.FsShift.String(),
			fmt.Sprintf("WORKSPACEKIT_FULL_WORKSPACE_BACKUP=%v", prep.FullWorkspaceBackup),
		)

		if err := cmd.Start(); err != nil {
			log.WithError(err).Error("failed to start ring0")
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
					_ = cmd.Process.Signal(sig)
					continue
				}

				_ = cmd.Process.Signal(unix.SIGTERM)
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
			if eerr, ok := err.(*exec.ExitError); ok {
				exitCode = eerr.ExitCode()
			}
			log.WithError(err).Error("unexpected exit")
			return
		}
		exitCode = 0 // once we get here everythings good
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

		exitCode := 1
		defer handleExit(&exitCode)

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		client, conn, err := connectToInWorkspaceDaemonService(ctx)
		if err != nil {
			log.WithError(err).Error("cannot connect to daemon")
			return
		}
		defer conn.Close()

		mapping := []*daemonapi.WriteIDMappingRequest_Mapping{
			{ContainerId: 0, HostId: 33333, Size: 1},
			{ContainerId: 1, HostId: 100000, Size: 65534},
		}
		if !ring1Opts.MappingEstablished {
			_, err = client.WriteIDMapping(ctx, &daemonapi.WriteIDMappingRequest{Pid: int64(os.Getpid()), Gid: false, Mapping: mapping})
			if err != nil {
				log.WithError(err).Error("cannot establish UID mapping")
				return
			}
			_, err = client.WriteIDMapping(ctx, &daemonapi.WriteIDMappingRequest{Pid: int64(os.Getpid()), Gid: true, Mapping: mapping})
			if err != nil {
				log.WithError(err).Error("cannot establish GID mapping")
				return
			}
			err = syscall.Exec("/proc/self/exe", append(os.Args, "--mapping-established"), os.Environ())
			if err != nil {
				log.WithError(err).Error("cannot exec /proc/self/exe")
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
		_ = unix.Prctl(unix.PR_SET_PDEATHSIG, uintptr(unix.SIGKILL), 0, 0, 0)
		runtime.UnlockOSThread()

		ring2Root, err := os.MkdirTemp("", "supervisor")
		if err != nil {
			log.WithError(err).Fatal("cannot create tempdir")
		}

		var fsshift api.FSShiftMethod
		if v, ok := api.FSShiftMethod_value[os.Getenv("WORKSPACEKIT_FSSHIFT")]; !ok {
			log.WithField("fsshift", os.Getenv("WORKSPACEKIT_FSSHIFT")).Fatal("unknown FS shift method")
		} else {
			fsshift = api.FSShiftMethod(v)
		}

		type mnte struct {
			Target string
			Source string
			FSType string
			Flags  uintptr
		}

		var mnts []mnte

		switch fsshift {
		case api.FSShiftMethod_FUSE:
			mnts = append(mnts,
				mnte{Target: "/", Source: "/.workspace/mark", Flags: unix.MS_BIND | unix.MS_REC},
			)
		case api.FSShiftMethod_SHIFTFS:
			mnts = append(mnts,
				mnte{Target: "/", Source: "/.workspace/mark", FSType: "shiftfs"},
			)
		default:
			log.WithField("fsshift", fsshift).Fatal("unknown FS shift method")
		}

		procMounts, err := ioutil.ReadFile("/proc/mounts")
		if err != nil {
			log.WithError(err).Fatal("cannot read /proc/mounts")
		}

		candidates, err := findBindMountCandidates(bytes.NewReader(procMounts), os.Readlink)
		if err != nil {
			log.WithError(err).Fatal("cannot detect mount candidates")
		}
		for _, c := range candidates {
			mnts = append(mnts, mnte{Target: c, Flags: unix.MS_BIND | unix.MS_REC})
		}
		mnts = append(mnts, mnte{Target: "/tmp", Source: "tmpfs", FSType: "tmpfs"})

		if adds := os.Getenv("GITPOD_WORKSPACEKIT_BIND_MOUNTS"); adds != "" {
			var additionalMounts []string
			err = json.Unmarshal([]byte(adds), &additionalMounts)
			if err != nil {
				log.WithError(err).Fatal("cannot unmarshal GITPOD_WORKSPACEKIT_BIND_MOUNTS")
			}
			for _, c := range additionalMounts {
				mnts = append(mnts, mnte{Target: c, Flags: unix.MS_BIND | unix.MS_REC})
			}
		}

		// FWB workspaces do not require mounting /workspace
		// if that is done, the backup will not contain any change in the directory
		if os.Getenv("WORKSPACEKIT_FULL_WORKSPACE_BACKUP") != "true" {
			mnts = append(mnts,
				mnte{Target: "/workspace", Flags: unix.MS_BIND | unix.MS_REC},
			)
		}

		for _, m := range mnts {
			dst := filepath.Join(ring2Root, m.Target)
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
				return
			}
		}

		env := make([]string, 0, len(os.Environ()))
		for _, e := range os.Environ() {
			if strings.HasPrefix(e, "WORKSPACEKIT_") {
				continue
			}
			env = append(env, e)
		}

		socketFN := filepath.Join(os.TempDir(), fmt.Sprintf("workspacekit-ring1-%d.unix", time.Now().UnixNano()))
		skt, err := net.Listen("unix", socketFN)
		if err != nil {
			log.WithError(err).Error("cannot create socket for ring2")
			return
		}
		defer skt.Close()

		cmd := exec.Command("/proc/self/exe", "ring2", socketFN)
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Pdeathsig:  syscall.SIGKILL,
			Cloneflags: syscall.CLONE_NEWNS | syscall.CLONE_NEWPID,
		}
		cmd.Dir = ring2Root
		cmd.Stdin = os.Stdin
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Env = env
		if err := cmd.Start(); err != nil {
			log.WithError(err).Error("failed to start the child process")
			return
		}
		sigc := sigproxy.ForwardAllSignals(context.Background(), cmd.Process.Pid)
		defer sigproxysignal.StopCatch(sigc)

		procLoc := filepath.Join(ring2Root, "proc")
		err = os.MkdirAll(procLoc, 0755)
		if err != nil {
			log.WithError(err).Error("cannot mount proc")
			return
		}
		_, err = client.MountProc(ctx, &daemonapi.MountProcRequest{
			Target: procLoc,
			Pid:    int64(cmd.Process.Pid),
		})
		if err != nil {
			log.WithError(err).Error("cannot mount proc")
			return
		}

		// We have to wait for ring2 to come back to us and connect to the socket we've passed along.
		// There's a chance that ring2 crashes or misbehaves, so we don't want to wait forever, hence
		// the someone complicated "accept" logic below.
		// If there's a deadline that can be set somewhere that we've missed, we should be using that
		// one instead.
		incoming := make(chan net.Conn, 1)
		errc := make(chan error, 1)
		go func() {
			defer close(incoming)
			defer close(errc)

			// Accept stops the latest when we close the socket.
			c, err := skt.Accept()
			if err != nil {
				errc <- err
				return
			}
			incoming <- c
		}()
		var ring2Conn *net.UnixConn
		for {
			var brek bool
			select {
			case err = <-errc:
				if err != nil {
					brek = true
				}
			case c := <-incoming:
				if c == nil {
					continue
				}
				ring2Conn = c.(*net.UnixConn)
				brek = true
			case <-time.After(ring2StartupTimeout):
				err = xerrors.Errorf("ring2 did not connect in time")
				brek = true
			}
			if brek {
				break
			}
		}
		if err != nil {
			log.WithError(err).Error("ring2 did not connect successfully")
			return
		}

		log.Info("signaling to child process")
		_, err = msgutil.MarshalToWriter(ring2Conn, ringSyncMsg{
			Stage:   1,
			Rootfs:  ring2Root,
			FSShift: fsshift,
		})
		if err != nil {
			log.WithError(err).Error("cannot send ring sync msg to ring2")
			return
		}

		log.Info("awaiting seccomp fd")
		scmpfd, err := receiveSeccmpFd(ring2Conn)
		if err != nil {
			log.WithError(err).Error("did not receive seccomp fd from ring2")
			return
		}

		if scmpfd == 0 {
			log.Warn("received 0 as ring2 seccomp fd - syscall handling is broken")
		} else {
			handler := &seccomp.InWorkspaceHandler{
				FD:          scmpfd,
				Daemon:      client,
				Ring2PID:    cmd.Process.Pid,
				Ring2Rootfs: ring2Root,
				BindEvents:  make(chan seccomp.BindEvent),
			}

			stp, errchan := seccomp.Handle(scmpfd, handler)
			defer close(stp)
			go func() {
				t := time.NewTicker(10 * time.Millisecond)
				defer t.Stop()
				for {
					// We use the ticker to rate-limit the errors from the syscall handler.
					// We're only handling low-frequency syscalls (e.g. mount), and don't want
					// the handler to hog the CPU because it fails on its fd.
					<-t.C
					err := <-errchan
					if err == nil {
						return
					}
					log.WithError(err).Warn("syscall handler error")
				}
			}()
		}

		go func() {
			err := lift.ServeLift(lift.DefaultSocketPath)
			if err != nil {
				log.WithError(err).Error("failed to serve ring1 command lift")
			}
		}()

		err = cmd.Wait()
		if err != nil {
			if eerr, ok := err.(*exec.ExitError); ok {
				exitCode = eerr.ExitCode()
			}
			log.WithError(err).Error("unexpected exit")
			return
		}
		exitCode = 0 // once we get here everythings good
	},
}

var (
	knownMountCandidatePaths = []string{
		"/workspace",
		"/sys",
		"/dev",
		"/etc/hosts",
		"/etc/hostname",
		"/etc/resolv.conf",
	}
)

// findBindMountCandidates attempts to find bind mount candidates in the ring0 mount namespace.
// It does that by either checking for knownMountCandidatePaths, or after rejecting based on filesystems (e.g. cgroup or proc),
// checking if in the root of the mountpoint there's a `..data` symlink pointing to a file starting with `..`.
// That's how configMaps and secrets behave in Kubernetes.
//
// Note/Caveat: configMap or secret volumes with a subPath do not behave as described above and will not be recognised by this function.
//              in those cases you'll want to use GITPOD_WORKSPACEKIT_BIND_MOUNTS to explicitely list those paths.
func findBindMountCandidates(procMounts io.Reader, readlink func(path string) (dest string, err error)) (mounts []string, err error) {
	scanner := bufio.NewScanner(procMounts)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 4 {
			continue
		}

		// accept known paths
		var (
			path   = fields[1]
			accept bool
		)
		for _, p := range knownMountCandidatePaths {
			if p == path {
				accept = true
				break
			}
		}
		if accept {
			mounts = append(mounts, path)
			continue
		}

		// reject known filesystems
		var (
			fs     = fields[0]
			reject bool
		)
		switch fs {
		case "cgroup", "devpts", "mqueue", "shm", "proc", "sysfs":
			reject = true
		}
		if reject {
			continue
		}

		// test remaining candidates if they're a Kubernetes configMap or secret
		ln, err := readlink(filepath.Join(path, "..data"))
		if err != nil {
			continue
		}
		if !strings.HasPrefix(ln, "..") {
			continue
		}

		mounts = append(mounts, path)
	}
	return mounts, scanner.Err()
}

func receiveSeccmpFd(conn *net.UnixConn) (libseccomp.ScmpFd, error) {
	buf := make([]byte, unix.CmsgSpace(4))

	err := conn.SetDeadline(time.Now().Add(5 * time.Second))
	if err != nil {
		return 0, err
	}

	f, err := conn.File()
	if err != nil {
		return 0, err
	}
	defer f.Close()
	connfd := int(f.Fd())

	_, _, _, _, err = unix.Recvmsg(connfd, nil, buf, 0)
	if err != nil {
		return 0, err
	}

	msgs, err := unix.ParseSocketControlMessage(buf)
	if err != nil {
		return 0, err
	}
	if len(msgs) != 1 {
		return 0, xerrors.Errorf("expected a single socket control message")
	}

	fds, err := unix.ParseUnixRights(&msgs[0])
	if err != nil {
		return 0, err
	}
	if len(fds) == 0 {
		return 0, xerrors.Errorf("expected a single socket FD")
	}

	return libseccomp.ScmpFd(fds[0]), nil
}

var ring2Opts struct {
	SupervisorPath string
}
var ring2Cmd = &cobra.Command{
	Use:   "ring2 <ring1Socket>",
	Short: "starts ring2",
	Args:  cobra.ExactArgs(1),
	Run: func(_cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, true, true)
		log := log.WithField("ring", 2)
		defer log.Info("done")

		exitCode := 1
		defer handleExit(&exitCode)

		// we talk to ring1 using a Unix socket, so that we can send the seccomp fd across.
		rconn, err := net.Dial("unix", args[0])
		if err != nil {
			log.WithError(err).Error("cannot connect to parent")
			return
		}
		conn := rconn.(*net.UnixConn)
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
		connf.Close()
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

func handleExit(ec *int) {
	exitCode := *ec
	if exitCode != 0 {
		sleepForDebugging()
	}
	os.Exit(exitCode)
}

func sleepForDebugging() {
	if os.Getenv("GITPOD_WORKSPACEKIT_SLEEP_FOR_DEBUGGING") != "true" {
		return
	}

	log.Info("sleeping five minutes to allow debugging")
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	select {
	case <-sigChan:
	case <-time.After(5 * time.Minute):
	}
}

type ringSyncMsg struct {
	Stage   int               `json:"stage"`
	Rootfs  string            `json:"rootfs"`
	FSShift api.FSShiftMethod `json:"fsshift"`
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
			return nil, nil, xerrors.Errorf("socket did not appear before context was canceled")
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
		wd, err := os.Executable()
		if err == nil {
			wd = filepath.Dir(wd)
			supervisorPath = filepath.Join(wd, "supervisor")
		} else {
			supervisorPath = "/.supervisor/supervisor"
		}
	}

	ring1Cmd.Flags().BoolVar(&ring1Opts.MappingEstablished, "mapping-established", false, "true if the UID/GID mapping has already been established")
	ring2Cmd.Flags().StringVar(&ring2Opts.SupervisorPath, "supervisor-path", supervisorPath, "path to the supervisor binary (taken from $GITPOD_WORKSPACEKIT_SUPERVISOR_PATH, defaults to '$PWD/supervisor')")
}
