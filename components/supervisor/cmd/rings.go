// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"io/ioutil"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/pkg/supervisor"
	daemonapi "github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/rootless-containers/rootlesskit/pkg/sigproxy"
	sigproxysignal "github.com/rootless-containers/rootlesskit/pkg/sigproxy/signal"
	"github.com/spf13/cobra"
)

var ring0Cmd = &cobra.Command{
	Use:    "ring0",
	Short:  "starts the supervisor ring0",
	Hidden: true,
	Run: func(_ *cobra.Command, args []string) {
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

		client, conn, err := supervisor.ConnectToInWorkspaceDaemonService(ctx)
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
		sigc := sigproxy.ForwardAllSignals(context.Background(), cmd.Process.Pid)
		defer sigproxysignal.StopCatch(sigc)

		err = cmd.Wait()
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
	Use:    "ring1",
	Short:  "starts the supervisor ring1",
	Hidden: true,
	Run: func(_cmd *cobra.Command, args []string) {
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

		client, conn, err := supervisor.ConnectToInWorkspaceDaemonService(ctx)
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
			// {Target: "/proc", Flags: syscall.MS_BIND | syscall.MS_REC},
			{Target: "/sys", Flags: syscall.MS_BIND | syscall.MS_REC},
			{Target: "/dev", Flags: syscall.MS_BIND | syscall.MS_REC},
			// TODO(cw): only mount /theia if it's in the mount table, i.e. this isn't a registry-facade workspace
			{Target: "/theia", Flags: syscall.MS_BIND | syscall.MS_REC},
			// TODO(cw): only mount /workspace if it's in the mount table, i.e. this isn't an FWB workspace
			{Target: "/workspace", Flags: syscall.MS_BIND | syscall.MS_REC},
			{Target: "/etc/hosts", Flags: syscall.MS_BIND | syscall.MS_REC},
			{Target: "/etc/hostname", Flags: syscall.MS_BIND | syscall.MS_REC},
			{Target: "/etc/resolv.conf", Flags: syscall.MS_BIND | syscall.MS_REC},
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
			err = syscall.Mount(m.Source, dst, m.FSType, m.Flags, "")
			if err != nil {
				log.WithError(err).WithField("dest", dst).Error("cannot establish mount")
				failed = true
				return
			}
		}

		cmd := exec.Command("/proc/self/exe", "ring2")
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Pdeathsig:  syscall.SIGKILL,
			Cloneflags: syscall.CLONE_NEWNS | syscall.CLONE_NEWPID,
		}
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

		log.Info("sending SIGCONT to child process")
		err = cmd.Process.Signal(syscall.SIGCONT)
		if err != nil {
			log.WithError(err).Error("cannot send SIGCONT to child process")
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

var ring2Cmd = &cobra.Command{
	Use:    "ring2",
	Short:  "starts the supervisor ring2",
	Hidden: true,
	Run: func(_cmd *cobra.Command, args []string) {
		log := log.WithField("ring", 2)
		defer log.Info("done")

		var failed bool
		defer func() {
			if !failed {
				return
			}
			sleepForDebugging()
		}()

		// if we don't have /proc already, wait for it
		if _, err := os.Stat("/proc/self/exe"); err != nil {
			log.Info("waiting for SIGCONT")
			sigChan := make(chan os.Signal, 1)
			signal.Notify(sigChan, syscall.SIGCONT, syscall.SIGTERM)
			sig := <-sigChan
			if sig == syscall.SIGTERM {
				log.Info("received SIGTERM - exiting")
				return
			}
			log.Info("received SIGCONT - contiuing startup")
		}

		err := syscall.PivotRoot(".", ".")
		if err != nil {
			log.WithError(err).Error("cannot pivot root")
			failed = true
			return
		}

		cmd := exec.Command("/proc/self/exe", "run", "--inns")
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Pdeathsig: syscall.SIGKILL,
			Credential: &syscall.Credential{
				Uid: 33333,
				Gid: 33333,
			},
		}
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

		err = cmd.Wait()
		if err != nil {
			log.WithError(err).Error("unexpected exit")
			failed = true
			return
		}
	},
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

func init() {
	rootCmd.AddCommand(ring0Cmd)
	rootCmd.AddCommand(ring1Cmd)
	rootCmd.AddCommand(ring2Cmd)

	ring1Cmd.Flags().BoolVar(&ring1Opts.MappingEstablished, "mapping-established", false, "true if the UID/GID mapping has already been established")
}
