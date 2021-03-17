// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"github.com/rootless-containers/rootlesskit/pkg/msgutil"
	"github.com/rootless-containers/rootlesskit/pkg/sigproxy"
	sigproxysignal "github.com/rootless-containers/rootlesskit/pkg/sigproxy/signal"
	"github.com/sirupsen/logrus"
	"github.com/spf13/pflag"
)

var log *logrus.Entry

var opts struct {
	RuncFacade           bool
	BinDir               string
	AutoInstall          bool
	UserAccessibleSocket bool
	Verbose              bool
}

func main() {
	self, err := os.Executable()
	if err != nil {
		log.WithError(err).Fatal()
	}

	pflag.BoolVarP(&opts.Verbose, "verbose", "v", false, "enables verbose logging")
	pflag.BoolVar(&opts.RuncFacade, "runc-facade", true, "enables the runc-facade to handle rootless idiosyncrasies")
	pflag.StringVar(&opts.BinDir, "bin-dir", filepath.Dir(self), "directory where runc-facade and slirp-docker-proxy are found")
	pflag.BoolVar(&opts.AutoInstall, "auto-install", true, "auto-install prerequisites (docker, slirp4netns)")
	pflag.BoolVar(&opts.UserAccessibleSocket, "user-accessible-socket", true, "chmod the Docker socket to make it user accessible")
	pflag.Parse()

	logger := logrus.New()
	if opts.Verbose {
		logger.SetLevel(logrus.DebugLevel)
	}

	var cmd string
	if args := pflag.Args(); len(args) > 0 {
		cmd = args[0]
	}

	switch cmd {
	case "child":
		log = logger.WithField("service", "runWithinNetns")
		err = runWithinNetns()
	default:
		log = logger.WithField("service", "runOutsideNetns")
		err = runOutsideNetns()
	}

	if err != nil {
		log.WithError(err).Fatal("failed")
	}
}

func runWithinNetns() (err error) {
	// magic file descriptor 3 was passed in from the parent using ExtraFiles
	fd := os.NewFile(uintptr(3), "")
	defer fd.Close()

	log.Debug("waiting for parent")
	var msg message
	_, err = msgutil.UnmarshalFromReader(fd, &msg)
	if err != nil {
		return err
	}
	if msg.Stage != 1 {
		return fmt.Errorf("expected stage 1 message, got %+q", msg)
	}
	log.Debug("parent is ready")

	args := []string{
		"--experimental",
		"--rootless",
		"--data-root=/workspace/.docker-root",
		"--userland-proxy", "--userland-proxy-path=" + filepath.Join(opts.BinDir, "slirp-docker-proxy"),
	}
	if opts.Verbose {
		args = append(args,
			"--log-level", "debug",
		)
	}
	if opts.RuncFacade {
		args = append(args,
			"--add-runtime", "gitpod="+filepath.Join(opts.BinDir, "runc-facade"),
			"--default-runtime", "gitpod",
		)
	}

	cmd := exec.Command("dockerd", args...)
	log.WithField("args", args).Debug("starting dockerd")
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Pdeathsig: syscall.SIGKILL,
	}
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err = cmd.Start()
	if err != nil {
		return err
	}
	sigc := sigproxy.ForwardAllSignals(context.Background(), cmd.Process.Pid)
	defer sigproxysignal.StopCatch(sigc)

	if opts.UserAccessibleSocket {
		go func() {
			for {
				err := os.Chmod("/var/run/docker.sock", 0666)

				if os.IsNotExist(err) {
					time.Sleep(500 * time.Millisecond)
					continue
				}
				if err != nil {
					log.WithError(err).Warn("cannot chmod docker socket")
				}

				return
			}
		}()
	}

	err = cmd.Wait()
	if err != nil {
		return err
	}
	return nil
}

func runOutsideNetns() error {
	err := ensurePrerequisites()
	if err != nil {
		return err
	}

	pipeR, pipeW, err := os.Pipe()
	if err != nil {
		return err
	}
	defer pipeW.Close()

	slirpAPI, err := os.CreateTemp("", "slirp4netns-api")
	if err != nil {
		return err
	}
	defer os.Remove(slirpAPI.Name())

	cmd := exec.Command("/proc/self/exe", append(os.Args[1:], "child")...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Pdeathsig:    syscall.SIGKILL,
		Unshareflags: syscall.CLONE_NEWNET,
	}
	cmd.ExtraFiles = []*os.File{pipeR}
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = append(os.Environ(),
		"DOCKERUP_SLIRP4NETNS_SOCKET="+slirpAPI.Name(),
	)
	err = cmd.Start()
	if err != nil {
		return err
	}
	sigc := sigproxy.ForwardAllSignals(context.Background(), cmd.Process.Pid)
	defer sigproxysignal.StopCatch(sigc)

	slirpCmd := exec.Command("slirp4netns",
		"--configure",
		"--mtu=65520",
		"--disable-host-loopback",
		"--api-socket", slirpAPI.Name(),
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
		return err
	}
	defer slirpCmd.Process.Kill()

	_, err = msgutil.MarshalToWriter(pipeW, message{Stage: 1})
	if err != nil {
		return err
	}
	log.Debug("signalled child (stage 1)")

	err = cmd.Wait()
	if err != nil {
		return err
	}

	return nil
}

func ensurePrerequisites() error {
	commands := map[string]string{
		"dockerd":     "docker.io",
		"slirp4netns": "slirp4netns",
	}

	var pkgs []string
	for cmd, pkg := range commands {
		if pth, _ := exec.LookPath(cmd); pth == "" {
			log.WithField("command", cmd).Warn("missing prerequisite")
			pkgs = append(pkgs, pkg)
		}
	}
	if len(pkgs) == 0 {
		return nil
	}

	errMissingPrerequisites := fmt.Errorf("missing prerequisites")
	if !opts.AutoInstall {
		return errMissingPrerequisites
	}
	if pth, _ := exec.LookPath("apt-get"); pth == "" {
		return errMissingPrerequisites
	}

	args := []string{"install", "-y"}
	args = append(args, pkgs...)
	cmd := exec.Command("apt-get", args...)
	cmd.Stdin = os.Stdin
	cmd.Stderr = os.Stderr
	cmd.Stdout = os.Stdout
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Pdeathsig: syscall.SIGKILL,
	}
	return cmd.Run()
}

type message struct {
	Stage int `json:"stage"`
}
