// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"syscall"
	"time"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	daemonapi "github.com/gitpod-io/gitpod/ws-daemon/api"
	"github.com/spf13/cobra"
	"golang.org/x/sys/unix"
)

var ring0Cmd = &cobra.Command{
	Use:   "ring0",
	Short: "starts ring0 - enter here",
	Run: func(_ *cobra.Command, args []string) {
		log.Init(ServiceName, Version, true, false)
		log := log.WithField("ring", 0)

		common_grpc.SetupLogging()

		exitCode := 1
		defer handleExit(&exitCode)

		defer log.Info("done")

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		client, err := connectToInWorkspaceDaemonService(ctx)
		if err != nil {
			log.WithError(err).Error("cannot connect to daemon")
			return
		}

		prep, err := client.PrepareForUserNS(ctx, &daemonapi.PrepareForUserNSRequest{})
		if err != nil {
			log.WithError(err).Fatal("cannot prepare for user namespaces")
			return
		}
		client.Close()

		defer func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			client, err := connectToInWorkspaceDaemonService(ctx)
			if err != nil {
				log.WithError(err).Error("cannot connect to daemon")
				return
			}
			defer client.Close()

			_, err = client.Teardown(ctx, &daemonapi.TeardownRequest{})
			if err != nil {
				log.WithError(err).Error("cannot trigger teardown")
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
					if isProcessAlreadyFinished(err) {
						err = nil
						return
					}

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
