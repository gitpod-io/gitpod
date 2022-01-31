// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
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
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/workspacekit/pkg/lift"
	"github.com/gitpod-io/gitpod/workspacekit/pkg/rings"
	"github.com/gitpod-io/gitpod/workspacekit/pkg/seccomp"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
	daemonapi "github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/rootless-containers/rootlesskit/pkg/msgutil"
	"github.com/rootless-containers/rootlesskit/pkg/sigproxy"
	sigproxysignal "github.com/rootless-containers/rootlesskit/pkg/sigproxy/signal"
	libseccomp "github.com/seccomp/libseccomp-golang"
	"github.com/spf13/cobra"
	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"
)

// ring1ShutdownTimeout is the time ring1 gets between SIGTERM and SIGKILL.
// We do this to ensure we have enough time left for ring0 to clean up prior
// to receiving SIGKILL from the kubelet.
//
// This time must give ring1 enough time to shut down (see time budgets in supervisor.go),
// and to talk to ws-daemon within the terminationGracePeriod of the workspace pod.
const ring1ShutdownTimeout = 20 * time.Second

var ring1Opts struct {
	MappingEstablished bool
}
var ring1Cmd = &cobra.Command{
	Use:   "ring1",
	Short: "starts ring1",
	Run: func(_cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, true, false)
		log := log.WithField("ring", 1)

		common_grpc.SetupLogging()

		exitCode := 1
		defer rings.HandleExit(&exitCode)

		defer log.Info("done")

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		mapping := []*daemonapi.WriteIDMappingRequest_Mapping{
			{ContainerId: 0, HostId: 33333, Size: 1},
			{ContainerId: 1, HostId: 100000, Size: 65534},
		}
		if !ring1Opts.MappingEstablished {
			client, err := rings.ConnectToInWorkspaceDaemonService(ctx)
			if err != nil {
				log.WithError(err).Error("cannot connect to daemon")
				return
			}
			defer client.Close()

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

		var (
			slirp4netnsSocket string
		)

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

		f, err := ioutil.TempDir("", "wskit-slirp4netns")
		if err != nil {
			log.WithError(err).Error("cannot create slirp4netns socket tempdir")
			return
		}

		slirp4netnsSocket = filepath.Join(f, "slirp4netns.sock")
		mnts = append(mnts, mnte{Target: "/.supervisor/slirp4netns.sock", Source: f, Flags: unix.MS_BIND | unix.MS_REC})

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

		// We deliberately do not bind mount `/etc/resolv.conf`, but instead place a copy
		// so that users in the workspace can modify the file.
		err = copyResolvConf(ring2Root)
		if err != nil {
			log.WithError(err).Error("cannot copy resolv.conf")
			return
		}

		env := make([]string, 0, len(os.Environ()))
		for _, e := range os.Environ() {
			if strings.HasPrefix(e, "WORKSPACEKIT_") {
				continue
			}
			env = append(env, e)
		}

		env = append(env, "WORKSPACEKIT_WRAP_NETNS=true")

		socketFN := filepath.Join(os.TempDir(), fmt.Sprintf("workspacekit-ring1-%d.unix", time.Now().UnixNano()))
		skt, err := net.Listen("unix", socketFN)
		if err != nil {
			log.WithError(err).Error("cannot create socket for ring2")
			return
		}
		defer skt.Close()

		var (
			cloneFlags uintptr = syscall.CLONE_NEWNS | syscall.CLONE_NEWPID | syscall.CLONE_NEWNET
		)

		cmd := exec.Command("/proc/self/exe", "ring2", socketFN)
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Pdeathsig:  syscall.SIGKILL,
			Cloneflags: cloneFlags,
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

		client, err := rings.ConnectToInWorkspaceDaemonService(ctx)
		if err != nil {
			log.WithError(err).Error("cannot connect to daemon")
			return
		}
		_, err = client.MountProc(ctx, &daemonapi.MountProcRequest{
			Target: procLoc,
			Pid:    int64(cmd.Process.Pid),
		})
		client.Close()

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

		slirpCmd := exec.Command(filepath.Join(filepath.Dir(ring2Opts.SupervisorPath), "slirp4netns"),
			"--configure",
			"--mtu=65520",
			"--disable-host-loopback",
			"--api-socket", slirp4netnsSocket,
			strconv.Itoa(cmd.Process.Pid),
			"tap0",
		)
		slirpCmd.SysProcAttr = &syscall.SysProcAttr{
			Pdeathsig: syscall.SIGKILL,
		}
		slirpCmd.Stdin = os.Stdin
		slirpCmd.Stdout = os.Stdout
		slirpCmd.Stderr = os.Stderr

		err = slirpCmd.Start()
		if err != nil {
			log.WithError(err).Error("cannot start slirp4netns")
			return
		}
		//nolint:errcheck
		defer slirpCmd.Process.Kill()

		log.Info("signaling to child process")
		_, err = msgutil.MarshalToWriter(ring2Conn, rings.SyncMsg{
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
				FD: scmpfd,
				Daemon: func(ctx context.Context) (seccomp.InWorkspaceServiceClient, error) {
					return rings.ConnectToInWorkspaceDaemonService(ctx)
				},
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

		if enclave := os.Getenv("WORKSPACEKIT_RING2_ENCLAVE"); enclave != "" {
			ecmd := exec.Command("/proc/self/exe", append([]string{"nsenter", "--target", strconv.Itoa(cmd.Process.Pid), "--mount", "--net"}, strings.Fields(enclave)...)...)
			ecmd.Stdout = os.Stdout
			ecmd.Stderr = os.Stderr

			err := ecmd.Start()
			if err != nil {
				log.WithError(err).WithField("cmd", enclave).Error("cannot run enclave")
				return
			}
		}

		go func() {
			err := lift.ServeLift(ctx, lift.DefaultSocketPath)
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
	}
	rejectMountPaths = map[string]struct{}{
		"/etc/resolv.conf": {},
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

		// reject known paths
		if _, ok := rejectMountPaths[path]; ok {
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

// copyResolvConf copies /etc/resolv.conf to <ring2root>/etc/resolv.conf
func copyResolvConf(ring2root string) error {
	fn := "/etc/resolv.conf"
	stat, err := os.Stat(fn)
	if err != nil {
		return err
	}

	org, err := os.Open(fn)
	if err != nil {
		return err
	}
	defer org.Close()

	dst, err := os.OpenFile(filepath.Join(ring2root, fn), os.O_CREATE|os.O_TRUNC|os.O_WRONLY, stat.Mode())
	if err != nil {
		return err
	}
	defer dst.Close()

	_, err = io.Copy(dst, org)
	if err != nil {
		return err
	}

	return nil
}

func receiveSeccmpFd(conn *net.UnixConn) (libseccomp.ScmpFd, error) {
	buf := make([]byte, unix.CmsgSpace(4))

	err := conn.SetDeadline(time.Now().Add(5 * time.Second))
	if err != nil {
		return 0, xerrors.Errorf("cannot setdeadline: %v", err)
	}

	f, err := conn.File()
	if err != nil {
		return 0, xerrors.Errorf("cannot open socket: %v", err)
	}
	defer f.Close()
	connfd := int(f.Fd())

	_, _, _, _, err = unix.Recvmsg(connfd, nil, buf, 0)
	if err != nil {
		return 0, xerrors.Errorf("cannot recvmsg from fd '%d': %v", connfd, err)
	}

	msgs, err := unix.ParseSocketControlMessage(buf)
	if err != nil {
		return 0, xerrors.Errorf("cannot parse socket control message: %v", err)
	}
	if len(msgs) != 1 {
		return 0, xerrors.Errorf("expected a single socket control message")
	}

	fds, err := unix.ParseUnixRights(&msgs[0])
	if err != nil {
		return 0, xerrors.Errorf("cannot parse unix rights: %v", err)
	}
	if len(fds) == 0 {
		return 0, xerrors.Errorf("expected a single socket FD")
	}

	return libseccomp.ScmpFd(fds[0]), nil
}

func init() {
	rootCmd.AddCommand(ring1Cmd)
	ring1Cmd.Flags().BoolVar(&ring1Opts.MappingEstablished, "mapping-established", false, "true if the UID/GID mapping has already been established")
}
