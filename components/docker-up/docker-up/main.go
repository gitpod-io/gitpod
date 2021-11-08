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
	"golang.org/x/sys/unix"
	"golang.org/x/xerrors"
)

var log *logrus.Entry

var opts struct {
	RuncFacade           bool
	BinDir               string
	AutoInstall          bool
	UserAccessibleSocket bool
	Verbose              bool
	DontWrapNetNS        bool
}

//go:embed docker.tgz
//go:embed docker-compose
//go:embed slirp4netns
var binaries embed.FS

const (
	dockerSocketFN = "/var/run/docker.sock"
)

func main() {
	self, err := os.Executable()
	if err != nil {
		logrus.WithError(err).Fatal()
	}

	pflag.BoolVarP(&opts.Verbose, "verbose", "v", false, "enables verbose logging")
	pflag.BoolVar(&opts.RuncFacade, "runc-facade", true, "enables the runc-facade to handle rootless idiosyncrasies")
	pflag.StringVar(&opts.BinDir, "bin-dir", filepath.Dir(self), "directory where runc-facade and slirp-docker-proxy are found")
	pflag.BoolVar(&opts.AutoInstall, "auto-install", true, "auto-install prerequisites (docker, slirp4netns)")
	pflag.BoolVar(&opts.UserAccessibleSocket, "user-accessible-socket", true, "chmod the Docker socket to make it user accessible")
	pflag.BoolVar(&opts.DontWrapNetNS, "dont-wrap-netns", os.Getenv("WORKSPACEKIT_WRAP_NETNS") == "true", "wrap the Docker daemon in a network namespace")
	pflag.Parse()

	logger := logrus.New()
	if opts.Verbose {
		logger.SetLevel(logrus.DebugLevel)
	}

	var cmd string
	if args := pflag.Args(); len(args) > 0 {
		cmd = args[0]
	}

	listenFD := os.Getenv("LISTEN_FDS") != ""
	if _, err := os.Stat(dockerSocketFN); !listenFD && (err == nil || !os.IsNotExist(err)) {
		logger.Fatalf("Docker socket already exists at %s.\nIn a Gitpod workspace Docker will start automatically when used.\nIf all else fails, please remove %s and try again.", dockerSocketFN, dockerSocketFN)
	}

	if opts.DontWrapNetNS {
		log = logger.WithField("service", "runWithinNetns")

		// we don't need to wrap the daemon in a network namespace, hence don't need slirp4netns
		delete(prerequisites, "slirp4netns")

		err = ensurePrerequisites()
		if err != nil {
			log.WithError(err).Fatal("failed")
		}

		err = runWithinNetns(false)
		if err != nil {
			log.WithError(err).Fatal("failed")
		}
		return
	}

	switch cmd {
	case "child":
		log = logger.WithField("service", "runWithinNetns")
		err = runWithinNetns(true)
	default:
		log = logger.WithField("service", "runOutsideNetns")
		err = runOutsideNetns()
	}

	if err != nil {
		log.WithError(err).Fatal("failed")
	}
}

func runWithinNetns(runInChildProcess bool) (err error) {
	listenFDs, _ := strconv.Atoi(os.Getenv("LISTEN_FDS"))

	if runInChildProcess {
		// magic file descriptor 3+listenFDs was passed in from the parent using ExtraFiles
		fd := os.NewFile(uintptr(3+listenFDs), "")
		defer fd.Close()

		log.Debug("waiting for parent")
		var msg message
		_, err = msgutil.UnmarshalFromReader(fd, &msg)
		if err != nil {
			return err
		}
		if msg.Stage != 1 {
			return xerrors.Errorf("expected stage 1 message, got %+q", msg)
		}
		log.Debug("parent is ready")
	}

	args := []string{
		"--experimental",
		"--rootless",
		"--data-root=/workspace/.docker-root",
	}
	if !opts.DontWrapNetNS {
		args = append(args, "--userland-proxy", "--userland-proxy-path="+filepath.Join(opts.BinDir, "slirp-docker-proxy"))
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

	if listenFDs > 0 {
		os.Setenv("LISTEN_PID", strconv.Itoa(os.Getpid()))
		args = append(args, "-H", "fd://")

		dockerd, err := exec.LookPath("dockerd")
		if err != nil {
			return err
		}
		argv := []string{dockerd}
		argv = append(argv, args...)
		return unix.Exec(dockerd, argv, os.Environ())
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
				err := os.Chmod(dockerSocketFN, 0666)

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
	if fds, err := strconv.Atoi(os.Getenv("LISTEN_FDS")); err == nil {
		for i := 0; i < fds; i++ {
			fmt.Printf("passing fd %d\n", i)
			cmd.ExtraFiles = append(cmd.ExtraFiles, os.NewFile(uintptr(3+i), ""))
		}
	} else {
		log.WithError(err).WithField("LISTEN_FDS", os.Getenv("listen_fds")).Warn("no LISTEN_FDS")
	}
	cmd.ExtraFiles = append(cmd.ExtraFiles, pipeR)
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
	//nolint:errcheck
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

var prerequisites = map[string]func() error{
	"dockerd":        installDocker,
	"docker-compose": installDockerCompose,
	"iptables":       installIptables,
	"slirp4netns":    installSlirp4netns,
}

func ensurePrerequisites() error {
	var pkgs []func() error
	for cmd, pkg := range prerequisites {
		if pth, _ := exec.LookPath(cmd); pth == "" {
			log.WithField("command", cmd).Warn("missing prerequisite")
			pkgs = append(pkgs, pkg)
		}
	}
	if len(pkgs) == 0 {
		return nil
	}

	errMissingPrerequisites := xerrors.Errorf("missing prerequisites")
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

			return xerrors.Errorf("Unable to extract container: %v\n", err)
		}

		hdrInfo := hdr.FileInfo()
		dstpath := path.Join("/usr/bin", strings.TrimPrefix(hdr.Name, "docker/"))
		mode := hdrInfo.Mode()

		p, _ := filepath.Abs(hdrInfo.Name())
		if strings.Contains(p, "..") {
			// do not allow directory traversal
			continue
		}

		switch hdr.Typeflag {
		case tar.TypeReg, tar.TypeRegA:
			file, err := os.OpenFile(dstpath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode)
			if err != nil {
				return xerrors.Errorf("unable to create file: %v", err)
			}

			if _, err := io.Copy(file, tarReader); err != nil {
				file.Close()
				return xerrors.Errorf("unable to write file: %v", err)
			}

			file.Close()
		}
		//nolint:errcheck
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
