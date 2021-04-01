// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// Download files to be embed in the binary
//go:generate ./dependencies.sh

package main

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"embed"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strconv"
	"strings"
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

//go:embed docker.tgz
//go:embed docker-compose
//go:embed slirp4netns
var binaries embed.FS

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
	commands := map[string]func() error{
		"dockerd":        installDocker,
		"docker-compose": installDockerCompose,
		"iptables":       installIptables,
		"slirp4netns":    installSlirp4netns,
	}

	var pkgs []func() error
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

	for _, pkg := range pkgs {
		err := pkg()
		if err != nil {
			return err
		}
	}

	return nil
}

type message struct {
	Stage int `json:"stage"`
}

func installDocker() error {
	binary, err := binaries.Open("docker.tgz")
	if err != nil {
		return err
	}
	defer binary.Close()

	gzipReader, err := gzip.NewReader(binary)
	if err != nil {
		return err
	}

	tarReader := tar.NewReader(gzipReader)
	for {
		hdr, err := tarReader.Next()
		if err != nil {
			if err == io.EOF {
				return nil
			}

			return fmt.Errorf("Unable to extract container: %v\n", err)
		}

		hdrInfo := hdr.FileInfo()
		dstpath := path.Join("/usr/bin", strings.TrimPrefix(hdr.Name, "docker/"))
		mode := hdrInfo.Mode()

		switch hdr.Typeflag {
		case tar.TypeReg, tar.TypeRegA:
			file, err := os.OpenFile(dstpath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode)
			if err != nil {
				return fmt.Errorf("unable to create file: %v", err)
			}

			if _, err := io.Copy(file, tarReader); err != nil {
				file.Close()
				return fmt.Errorf("unable to write file: %v", err)
			}

			file.Close()
		}

		os.Chtimes(dstpath, hdr.AccessTime, hdr.ModTime)
	}

	return nil
}

func installDockerCompose() error {
	return installBinary("docker-compose", "/usr/local/bin/docker-compose")
}

func installIptables() error {
	pth, _ := exec.LookPath("apt-get")
	if pth != "" {
		cmd := exec.Command("/bin/sh", "-c", "apt-get update && apt-get install -y iptables xz-utils")
		cmd.Stdin = os.Stdin
		cmd.Stderr = os.Stderr
		cmd.Stdout = os.Stdout
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Pdeathsig: syscall.SIGKILL,
		}

		return cmd.Run()
	}

	pth, _ = exec.LookPath("apk")
	if pth != "" {
		cmd := exec.Command("/bin/sh", "-c", "apk add --no-cache iptables xz")
		cmd.Stdin = os.Stdin
		cmd.Stderr = os.Stderr
		cmd.Stdout = os.Stdout
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Pdeathsig: syscall.SIGKILL,
		}

		return cmd.Run()
	}

	// the container is not debian/ubuntu/alpine
	log.WithField("command", "dockerd").Warn("Please install dockerd dependencies: iptables")
	return nil
}

func installSlirp4netns() error {
	return installBinary("slirp4netns", "/usr/bin/slirp4netns")
}

func installBinary(name, dst string) error {
	binary, err := binaries.Open(name)
	if err != nil {
		return err
	}
	defer binary.Close()

	file, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = io.Copy(file, binary)
	if err != nil {
		return err
	}

	return os.Chmod(dst, 0755)
}
