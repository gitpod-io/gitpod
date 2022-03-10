// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
)

func newSSHServer(ctx context.Context, cfg *Config, envvars []string) (*sshServer, error) {
	bin, err := os.Executable()
	if err != nil {
		return nil, xerrors.Errorf("cannot find executable path: %w", err)
	}

	sshkey := filepath.Join(filepath.Dir(bin), "ssh", "sshkey")
	if _, err := os.Stat(sshkey); err != nil {
		err := prepareSSHKey(ctx, sshkey)
		if err != nil {
			return nil, xerrors.Errorf("unexpected error creating SSH key: %w", err)
		}
	}
	err = writeSSHEnv(cfg, envvars)
	if err != nil {
		return nil, xerrors.Errorf("unexpected error creating SSH env: %w", err)
	}

	return &sshServer{
		ctx:     ctx,
		cfg:     cfg,
		sshkey:  sshkey,
		envvars: envvars,
	}, nil
}

type sshServer struct {
	ctx     context.Context
	cfg     *Config
	envvars []string

	sshkey string
}

// ListenAndServe listens on the TCP network address laddr and then handle packets on incoming connections.
func (s *sshServer) listenAndServe() error {
	listener, err := net.Listen("tcp", fmt.Sprintf(":%v", s.cfg.SSHPort))
	if err != nil {
		return err
	}

	for {
		conn, err := listener.Accept()
		if err != nil {
			log.WithError(err).Error("listening for SSH connection")
			continue
		}

		go s.handleConn(s.ctx, conn)
	}
}

func (s *sshServer) handleConn(ctx context.Context, conn net.Conn) {
	bin, err := os.Executable()
	if err != nil {
		return
	}

	defer conn.Close()

	openssh := filepath.Join(filepath.Dir(bin), "ssh", "sshd")
	if _, err := os.Stat(openssh); err != nil {
		return
	}

	args := []string{
		"-iedD", "-f/dev/null",
		"-oProtocol 2",
		"-oAllowUsers gitpod",
		"-oPasswordAuthentication no",
		"-oChallengeResponseAuthentication no",
		"-oPermitRootLogin no",
		"-oLoginGraceTime 20",
		"-oPrintLastLog no",
		"-oPermitUserEnvironment yes",
		"-oHostKey " + s.sshkey,
		"-oPidFile /dev/null",
		"-oUseDNS no", // Disable DNS lookups.
		"-oSubsystem sftp internal-sftp",
		"-oStrictModes no", // don't care for home directory and file permissions
	}

	if os.Getenv("SUPERVISOR_DEBUG_ENABLE") != "" {
		args = append(args, "-oLogLevel DEBUG")
	}

	socketFD, err := conn.(*net.TCPConn).File()
	if err != nil {
		log.WithError(err).Error("cannot start SSH server")
		return
	}
	defer socketFD.Close()

	log.WithField("args", args).Debug("sshd flags")
	cmd := exec.CommandContext(ctx, openssh, args...)
	cmd = runAsGitpodUser(cmd)
	cmd.Env = s.envvars
	cmd.ExtraFiles = []*os.File{socketFD}
	cmd.Stderr = os.Stderr
	cmd.Stdin = bufio.NewReader(socketFD)
	cmd.Stdout = bufio.NewWriter(socketFD)

	err = cmd.Start()
	if err != nil {
		log.WithError(err).Error("cannot start SSH server: %w", err)
		return
	}

	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	log.Debug("sshd started")

	select {
	case <-ctx.Done():
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		return
	case err = <-done:
		if err != nil {
			log.WithError(err).Error("SSH server stopped")
		}
	}
}

func prepareSSHKey(ctx context.Context, sshkey string) error {
	bin, err := os.Executable()
	if err != nil {
		return xerrors.Errorf("cannot find executable path: %w", err)
	}

	openssh := filepath.Join(filepath.Dir(bin), "ssh", "sshd")
	if _, err := os.Stat(openssh); err != nil {
		return xerrors.Errorf("cannot locate sshd binary in path %v", openssh)
	}

	sshkeygen := filepath.Join(filepath.Dir(bin), "ssh", "ssh-keygen")
	if _, err := os.Stat(sshkeygen); err != nil {
		return xerrors.Errorf("cannot locate ssh-keygen (path %v)", sshkeygen)
	}

	keycmd := exec.Command(sshkeygen, "-t", "ecdsa", "-q", "-N", "", "-f", sshkey)
	// We need to force HOME because the Gitpod user might not have existed at the start of the container
	// which makes the container runtime set an invalid HOME value.
	keycmd.Env = func() []string {
		env := os.Environ()
		res := make([]string, 0, len(env))
		for _, e := range env {
			if strings.HasPrefix(e, "HOME=") {
				e = "HOME=/root"
			}
			res = append(res, e)
		}
		return res
	}()

	_, err = keycmd.CombinedOutput()
	if err != nil {
		return xerrors.Errorf("cannot create SSH hostkey file: %w", err)
	}

	err = os.Chown(sshkey, gitpodUID, gitpodGID)
	if err != nil {
		return xerrors.Errorf("cannot chown SSH hostkey file: %w", err)
	}

	return nil
}

func writeSSHEnv(cfg *Config, envvars []string) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	d := filepath.Join(home, ".ssh")
	err = os.MkdirAll(d, 0o700)
	if err != nil {
		return xerrors.Errorf("cannot create $HOME/.ssh: %w", err)
	}

	fn := filepath.Join(d, "supervisor_env")
	err = os.WriteFile(fn, []byte(strings.Join(envvars, "\n")), 0o644)
	if err != nil {
		return xerrors.Errorf("cannot write %s: %w", fn, err)
	}

	_ = exec.Command("chown", "-R", fmt.Sprintf("%d:%d", gitpodUID, gitpodGID), d).Run()

	return nil
}
