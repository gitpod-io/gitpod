// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/pkg/iwh"
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
		defer log.Info("done")

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
			log.WithError(err).Fatal("failed to start the child")
		}
		sigc := sigproxy.ForwardAllSignals(context.Background(), cmd.Process.Pid)
		defer sigproxysignal.StopCatch(sigc)

		err := cmd.Wait()
		if err != nil {
			log.WithError(err).Error("unexpected exit - sleeping for five minutes to allow debugging")
			time.Sleep(5 * time.Minute)
			os.Exit(1)
		}
	},
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

			log.Error("ring1 failure -  sleeping five minutes to allow debugging")
			time.Sleep(5 * time.Minute)
			os.Exit(1)
		}()

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		client, conn, err := iwh.NewInWorkspaceHelper(ctx)
		if err != nil {
			log.WithError(err).Error("cannot connect to daemon")
			failed = true
			return
		}
		defer conn.Close()

		mapping := []*daemonapi.UidmapCanaryRequest_Mapping{
			{ContainerId: 0, HostId: 33333, Size: 1},
			{ContainerId: 1, HostId: 100000, Size: 65534},
		}
		_, err = client.WriteIDMapping(ctx, &daemonapi.UidmapCanaryRequest{Pid: int64(os.Getpid()), Gid: false, Mapping: mapping})
		if err != nil {
			log.WithError(err).Error("cannot establish UID mapping")
			failed = true
			return
		}
		_, err = client.WriteIDMapping(ctx, &daemonapi.UidmapCanaryRequest{Pid: int64(os.Getpid()), Gid: true, Mapping: mapping})
		if err != nil {
			log.WithError(err).Error("cannot establish GID mapping")
			failed = true
			return
		}

		_, err = client.MountShiftfsMark(ctx, &daemonapi.MountShiftfsMarkRequest{})
		if err != nil {
			log.WithError(err).Error("cannot mount shiftfs mark")
			failed = true
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

		cmd := exec.Command("/proc/self/exe", "ring2")
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Pdeathsig: syscall.SIGKILL,
		}
		cmd.Stdin = os.Stdin
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Env = os.Environ()

		if err := cmd.Start(); err != nil {
			log.WithError(err).Error("failed to start the child")
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

var ring2Cmd = &cobra.Command{
	Use:    "ring2",
	Short:  "starts the supervisor ring2",
	Hidden: true,
	Run: func(_cmd *cobra.Command, args []string) {
		log := log.WithField("ring", 2)
		defer log.Info("done")

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
			{Target: "/proc", Flags: syscall.MS_BIND | syscall.MS_REC},
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

			err = syscall.Mount(m.Source, dst, m.FSType, m.Flags, "")
			if err != nil {
				log.WithError(err).WithField("dest", dst).Error("cannot establish mount")
				// exit without fatal s.t. the defers still run
				return
			}
		}

		err = syscall.Chroot(tmpdir)
		if err != nil {
			log.WithError(err).WithField("tmpdir", tmpdir).Error("cannot chroot")
			return
		}

		// TODO(cw) set no_new_priv

		cmd := exec.Command("/proc/self/exe", "run", "--without-teardown-canary")
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Pdeathsig:  syscall.SIGKILL,
			Cloneflags: syscall.CLONE_NEWPID | syscall.CLONE_NEWNS,
		}
		cmd.Stdin = os.Stdin
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Env = os.Environ()

		if err := cmd.Start(); err != nil {
			log.WithError(err).Fatal("failed to start the child")
		}
		sigc := sigproxy.ForwardAllSignals(context.Background(), cmd.Process.Pid)
		defer sigproxysignal.StopCatch(sigc)

		err = cmd.Wait()
		if err != nil {
			log.WithError(err).Error("unexpected exit")
			return
		}
	},
}

func init() {
	rootCmd.AddCommand(ring0Cmd)
	rootCmd.AddCommand(ring1Cmd)
	rootCmd.AddCommand(ring2Cmd)
}
