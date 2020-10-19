// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"io/ioutil"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/pkg/iwh"
	"github.com/gitpod-io/gitpod/supervisor/pkg/supervisor"
	daemonapi "github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/rootless-containers/rootlesskit/pkg/sigproxy"
	sigproxysignal "github.com/rootless-containers/rootlesskit/pkg/sigproxy/signal"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
)

var ring0Cmd = &cobra.Command{
	Use:    "ring0",
	Short:  "starts the supervisor ring0",
	Hidden: true,
	Run: func(_ *cobra.Command, args []string) {
		log := log.WithField("ring", 0)

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
			log.WithError(err).Fatal("unexpected exit")
		}
	},
}

var ring1Cmd = &cobra.Command{
	Use:    "ring1",
	Short:  "starts the supervisor ring1",
	Hidden: true,
	Run: func(_cmd *cobra.Command, args []string) {
		log := log.WithField("ring", 1)

		cfg, err := supervisor.GetConfig()
		if err != nil {
			log.WithError(err).Fatal("configuration error")
		}

		iwh := iwh.NewInWorkspaceHelper("/", make(chan bool, 0))
		srv := grpc.NewServer()
		iwh.RegisterGRPC(srv)

		l, err := net.Listen("tcp", fmt.Sprintf(":%d", cfg.APIEndpointPort))
		if err != nil {
			log.WithError(err).Fatal("cannot serve API endpoint for IWH")
		}
		go func() {
			err = srv.Serve(l)
			if err != nil {
				log.WithError(err).Fatal("cannot serve API endpoint for IWH")
			}
		}()

		select {
		case <-iwh.IDMapperService().Available():
		case <-time.After(30 * time.Second):
			log.Error("timeout while waiting for canaries to connect")
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		mapping := []*daemonapi.UidmapCanaryRequest_Mapping{
			{ContainerId: 0, HostId: 33333, Size: 1},
			{ContainerId: 1, HostId: 100000, Size: 65534},
		}
		err = iwh.IDMapperService().WriteIDMap(ctx, &daemonapi.UidmapCanaryRequest{Pid: int64(os.Getpid()), Gid: false, Mapping: mapping})
		if err != nil {
			log.WithError(err).Fatal("cannot establish UID mapping")
		}
		err = iwh.IDMapperService().WriteIDMap(ctx, &daemonapi.UidmapCanaryRequest{Pid: int64(os.Getpid()), Gid: true, Mapping: mapping})
		if err != nil {
			log.WithError(err).Fatal("cannot establish GID mapping")
		}

		srv.GracefulStop()
		l.Close()

		cmd := exec.Command("/proc/self/exe", "ring2")
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Pdeathsig: syscall.SIGKILL,
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
		}

		l, err = net.Listen("tcp", fmt.Sprintf(":%d", cfg.APIEndpointPort))
		if err != nil {
			log.WithError(err).Fatal("cannot serve API endpoint for IWH")
		}
		go func() {
			err = srv.Serve(l)
			if err != nil {
				log.WithError(err).Fatal("cannot serve API endpoint for IWH")
			}
		}()

		select {
		case <-iwh.TeardownService().Available():
		case <-time.After(30 * time.Second):
			log.Error("timeout while waiting for canaries to connect")
		}

		ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		err = iwh.TeardownService().Teardown(ctx)
		if err != nil {
			log.WithError(err).Error("cannot trigger teardown canary")
		}
	},
}

var ring2Cmd = &cobra.Command{
	Use:    "ring2",
	Short:  "starts the supervisor ring2",
	Hidden: true,
	Run: func(_cmd *cobra.Command, args []string) {
		log := log.WithField("ring", 2)

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
			{Target: "/", Source: "/.mark", FSType: "shiftfs"},
			{Target: "/proc", Flags: syscall.MS_BIND | syscall.MS_REC},
			{Target: "/sys", Flags: syscall.MS_BIND | syscall.MS_REC},
			{Target: "/dev", Flags: syscall.MS_BIND | syscall.MS_REC},
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
			defer func(pth string) {
				err := syscall.Unmount(pth, 0)
				if err != nil {
					log.WithError(err).Errorf("cannot unmount %s", pth)
				}
			}(dst)
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

var ring3Cmd = &cobra.Command{
	Use:    "ring3",
	Short:  "starts the supervisor ring3 (will be 'supervisor run' in the future)",
	Hidden: true,
	Run: func(_cmd *cobra.Command, args []string) {
		log := log.WithField("ring", 3)

		cmd := exec.Command("/bin/bash", "-i", "-l")
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Pdeathsig: syscall.SIGKILL,
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
			log.WithError(err).Fatal("unexpected exit")
		}
	},
}

func init() {
	rootCmd.AddCommand(ring0Cmd)
	rootCmd.AddCommand(ring1Cmd)
	rootCmd.AddCommand(ring2Cmd)
	rootCmd.AddCommand(ring3Cmd)
}
