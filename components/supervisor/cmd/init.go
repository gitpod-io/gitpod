// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"sync"
	"syscall"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
	"golang.org/x/sys/unix"
)

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "init the supervisor",
	Run: func(cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, true, false)
		// Because we're reaping with PID -1, we'll catch the child process for
		// which we've missed the notification anyways.
		var (
			sigInput      = make(chan os.Signal, 1)
			sigReaper     = make(chan os.Signal, 1)
			sigSupervisor = make(chan os.Signal, 1)
		)
		signal.Notify(sigInput, syscall.SIGCHLD, os.Interrupt, syscall.SIGTERM)
		go func() {
			for s := range sigInput {
				select {
				case sigReaper <- s:
				default:
				}
				select {
				case sigSupervisor <- s:
				default:
				}
			}
		}()

		go reaper(sigReaper)

		supervisorPath, err := os.Executable()
		if err != nil {
			supervisorPath = "/.supervisor/supervisor"
		}
		runCommand := exec.Command(supervisorPath, "run")
		runCommand.Args[0] = "supervisor"
		runCommand.Stdin = os.Stdin
		runCommand.Stdout = os.Stdout
		runCommand.Stderr = os.Stderr
		runCommand.Env = os.Environ()
		err = runCommand.Start()
		if err != nil {
			log.WithError(err).Error("supervisor run start error")
			return
		}

		var wg sync.WaitGroup
		wg.Add(1)
		go func() {
			defer wg.Done()

			err := runCommand.Wait()
			if err != nil && !(strings.Contains(err.Error(), "signal: interrupt") || strings.Contains(err.Error(), "no child processes")) {
				log.WithError(err).Error("supervisor run error")
				return
			}
		}()

		s := <-sigSupervisor
		_ = runCommand.Process.Signal(s)
		wg.Wait()
	},
}

func init() {
	rootCmd.AddCommand(initCmd)
}

func reaper(sigs <-chan os.Signal) {
	// The reaper can be turned into a terminating reaper by writing true to this channel.
	// When in terminating mode, the reaper will send SIGTERM to each child that gets reparented
	// to us and is still running. We use this mechanism to send SIGTERM to a shell child processes
	// that get reparented once their parent shell terminates during shutdown.
	var terminating bool

	for s := range sigs {
		if s != syscall.SIGCHLD {
			terminating = true
			continue
		}

		for {
			// wait on the process, hence remove it from the process table
			pid, err := unix.Wait4(-1, nil, 0, nil)
			// if we've been interrupted, try again until we're done
			for err == syscall.EINTR {
				pid, err = unix.Wait4(-1, nil, 0, nil)
			}
			// The calling process does not have any unwaited-for children. Let's wait for a SIGCHLD notification.
			if err == unix.ECHILD {
				break
			}
			if err != nil {
				log.WithField("pid", pid).WithError(err).Debug("cannot call waitpid() for re-parented child")
			}
			if !terminating {
				continue
			}
			proc, err := os.FindProcess(pid)
			if err != nil {
				log.WithField("pid", pid).WithError(err).Debug("cannot find re-parented process")
				continue
			}
			err = proc.Signal(syscall.SIGTERM)
			if err != nil {
				if !strings.Contains(err.Error(), "os: process already finished") {
					log.WithField("pid", pid).WithError(err).Debug("cannot send SIGTERM to re-parented process")
				}
				continue
			}
			log.WithField("pid", pid).Debug("SIGTERM'ed reparented child process")
		}
	}
}
