// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"fmt"
	"io"
	"io/ioutil"
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
		ctx:       ctx,
		cfg:       cfg,
		ipAddress: localIP(),
	}
}

type sshServer struct {
	ctx context.Context
	cfg *Config

	ipAddress string

	cmd *exec.Cmd
	mu  sync.Mutex
}

// ListenAndServe listens on the TCP network address laddr and then handle packets on incoming connections.
func (s *sshServer) listenAndServe() error {
	addr := fmt.Sprintf("%v:%v", s.ipAddress, s.cfg.SSHPort)
	log.WithField("address", addr).Info("starting TCP listener")
	listener, err := net.Listen("tcp", addr)
	if err != nil {
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
		if s.cmd == nil {
			cmd := prepareSSHServer(s.ctx, s.cfg)
			if cmd != nil {
				s.cmd = cmd
			}
		}
		s.mu.Unlock()

		go s.handleConn(conn)
	}
}

func (s *sshServer) handleConn(conn net.Conn) {
	rconn, err := net.Dial("tcp", "127.0.0.1:22")
	if err != nil {
		return
	}

	go pipe(conn, rconn)
	go pipe(rconn, conn)
}

func pipe(from, to net.Conn) {
	doCopy := func(s, c net.Conn, cancel chan<- bool) {
		_, _ = io.Copy(s, c)
		cancel <- true
	}

	cancel := make(chan bool, 2)

	go doCopy(to, from, cancel)
	go doCopy(from, to, cancel)

	<-cancel
}

func prepareSSHServer(ctx context.Context, cfg *Config) *exec.Cmd {
	bin, err := os.Executable()
	if err != nil {
		log.WithError(err).Error("cannot find executable path")
		return nil
	}

	dropbear := filepath.Join(filepath.Dir(bin), "dropbear", "dropbear")
	if _, err := os.Stat(dropbear); err != nil {
		log.WithError(err).WithField("path", dropbear).Error("cannot locate dropebar binary")
		return nil
	}

	dropbearkey := filepath.Join(filepath.Dir(bin), "dropbear", "dropbearkey")
	if _, err := os.Stat(dropbearkey); err != nil {
		log.WithError(err).WithField("path", dropbearkey).Error("cannot locate dropebarkey")
		return nil
	}

	hostkeyFN, err := ioutil.TempFile("", "hostkey")
	if err != nil {
		log.WithError(err).Error("cannot create hostkey file")
		return nil
	}
	hostkeyFN.Close()
	os.Remove(hostkeyFN.Name())

	keycmd := exec.Command(dropbearkey, "-t", "rsa", "-f", hostkeyFN.Name())
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
		return nil
	}
	_ = os.Chown(hostkeyFN.Name(), gitpodUID, gitpodGID)

	cmd := exec.Command(dropbear, "-F", "-E", "-w", "-s", "-p", "127.0.0.1:22", "-r", hostkeyFN.Name())
	cmd = runAsGitpodUser(cmd)
	cmd.Env = buildChildProcEnv(cfg, nil)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err = cmd.Start()
	if err != nil {
		log.WithError(err).Error("cannot start SSH server")
		return nil
	}

	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()
	select {
	case <-ctx.Done():
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
		return nil
	case err = <-done:
		if err != nil {
			log.WithError(err).Error("SSH server stopped")
		}
	}

	return cmd
}

func localIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ""
	}
	for _, address := range addrs {
		if ipnet, ok := address.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String()
			}
		}
	}
	return ""
}
