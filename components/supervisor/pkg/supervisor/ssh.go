// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"github.com/gitpod-io/gitpod/common-go/log"
)

func newSSHServer(ctx context.Context, cfg *Config) *sshServer {
	return &sshServer{
		ctx: ctx,
		cfg: cfg,
	}
}

type sshServer struct {
	ctx context.Context
	cfg *Config

	mu sync.Mutex
}

// ListenAndServe listens on the TCP network address laddr and then handle packets on incoming connections.
func (s *sshServer) listenAndServe() error {
	listener, err := net.Listen("tcp", fmt.Sprintf(":%v", s.cfg.SSHPort))
	if err != nil {
		return err
	}

	bin, err := os.Executable()
	if err != nil {
		log.WithError(err).Error("cannot find executable path")
		return err
	}

	for {
		conn, err := listener.Accept()
		if err != nil {
			log.WithError(err).Error("listening for SSH connection")
			continue
		}

		log.Info("checking for SSH server")
		s.mu.Lock()
		sshkey := filepath.Join(filepath.Dir(bin), "dropbear", "sshkey")
		if _, err := os.Stat(sshkey); err != nil {
			prepareSSHServer(s.ctx, s.cfg)
		}
		s.mu.Unlock()

		go s.handleConn(s.ctx, s.cfg, conn)
	}
}

func (s *sshServer) handleConn(ctx context.Context, cfg *Config, conn net.Conn) {
	bin, err := os.Executable()
	if err != nil {
		log.WithError(err).Error("cannot find executable path")
		return
	}

	dropbear := filepath.Join(filepath.Dir(bin), "dropbear", "dropbear")
	if _, err := os.Stat(dropbear); err != nil {
		log.WithError(err).WithField("path", dropbear).Error("cannot locate dropebar binary")
		return
	}

	sshkey := filepath.Join(filepath.Dir(bin), "dropbear", "sshkey")
	cmd := exec.Command(dropbear, "-F", "-E", "-w", "-s", "-i", "-r", sshkey)
	cmd = runAsGitpodUser(cmd)
	cmd.Env = buildChildProcEnv(cfg, nil)
	cmd.Stderr = os.Stderr
	cmd.Stdout = conn
	cmd.Stdin = conn

	err = cmd.Start()
	if err != nil {
		log.WithError(err).Error("cannot start SSH server")
		conn.Close()
		return
	}

	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	select {
	case <-ctx.Done():
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
			conn.Close()
		}
		return
	case err = <-done:
		if err != nil {
			log.WithError(err).Error("SSH server stopped")
		}
	}
}

func prepareSSHServer(ctx context.Context, cfg *Config) {
	bin, err := os.Executable()
	if err != nil {
		log.WithError(err).Error("cannot find executable path")
		return
	}

	dropbearkey := filepath.Join(filepath.Dir(bin), "dropbear", "dropbearkey")
	if _, err := os.Stat(dropbearkey); err != nil {
		log.WithError(err).WithField("path", dropbearkey).Error("cannot locate dropebarkey")
		return
	}

	sshkey := filepath.Join(filepath.Dir(bin), "dropbear", "sshkey")
	if _, err := os.Stat(sshkey); err != nil {
		keycmd := exec.Command(dropbearkey, "-t", "rsa", "-f", sshkey)
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
		out, err := keycmd.CombinedOutput()
		if err != nil {
			log.WithError(err).WithField("out", string(out)).Error("cannot create hostkey file")
			return
		}
		_ = os.Chown(sshkey, gitpodUID, gitpodGID)
	}
}
