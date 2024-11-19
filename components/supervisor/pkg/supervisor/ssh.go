// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor

import (
	"bufio"
	"context"
	"fmt"
	"io/ioutil"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/pkg/dropwriter"
	"github.com/sirupsen/logrus"
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
	err = ensureSSHDir(cfg)
	if err != nil {
		return nil, xerrors.Errorf("unexpected error creating SSH dir: %w", err)
	}
	caPath := filepath.Join(filepath.Dir(bin), "ssh", "ca.pem")

	err = ensureSSHCAFile(cfg, caPath)
	if err != nil {
		return nil, xerrors.Errorf("unexpected error creating SSH ca pem: %w", err)
	}

	err = ensurePrivsepDir()
	if err != nil {
		return nil, xerrors.Errorf("unexpected error creating privsep path: %w", err)
	}

	return &sshServer{
		ctx:     ctx,
		cfg:     cfg,
		sshkey:  sshkey,
		envvars: envvars,
		caPath:  caPath,
	}, nil
}

type sshServer struct {
	ctx     context.Context
	cfg     *Config
	envvars []string

	sshkey string
	caPath string
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
	sshdSession := filepath.Join(filepath.Dir(bin), "ssh", "sshd-session")
	if _, err := os.Stat(sshdSession); err != nil {
		sshdSession = ""
	}

	var args []string
	args = append(args,
		"-ieD", "-f/dev/null",
		"-oProtocol 2",
		"-oAllowUsers gitpod",
		"-oPasswordAuthentication no",
		"-oChallengeResponseAuthentication no",
		"-oPermitRootLogin yes",
		"-oLoginGraceTime 20",
		"-oPrintLastLog no",
		"-oPermitUserEnvironment yes",
		"-oHostKey "+s.sshkey,
		"-oPidFile /dev/null",
		"-oUseDNS no", // Disable DNS lookups.
		"-oSubsystem sftp internal-sftp",
		"-oStrictModes no", // don't care for home directory and file permissions
		"-oTrustedUserCAKeys "+s.caPath,
	)
	if sshdSession != "" {
		args = append(args, "-oSshdSessionPath "+sshdSession)
	}
	// can be configured with gp env LOG_LEVEL=DEBUG to see SSH sessions/channels
	sshdLogLevel := "ERROR"
	switch log.Log.Logger.GetLevel() {
	case logrus.PanicLevel:
		sshdLogLevel = "FATAL"
	case logrus.FatalLevel:
		sshdLogLevel = "FATAL"
	case logrus.ErrorLevel:
		sshdLogLevel = "ERROR"
	case logrus.WarnLevel:
		sshdLogLevel = "INFO"
	case logrus.InfoLevel:
		sshdLogLevel = "INFO"
	case logrus.DebugLevel:
		sshdLogLevel = "VERBOSE"
	case logrus.TraceLevel:
		sshdLogLevel = "DEBUG"
	}
	args = append(args, "-oLogLevel "+sshdLogLevel)

	envs := make([]string, 0)
	for _, env := range s.envvars {
		s := strings.SplitN(env, "=", 2)
		if len(s) != 2 {
			continue
		}
		envs = append(envs, fmt.Sprintf("%s=%s", s[0], fmt.Sprintf("\"%s\"", strings.ReplaceAll(strings.ReplaceAll(s[1], `\`, `\\`), `"`, `\"`))))
	}
	if len(envs) > 0 {
		args = append(args, fmt.Sprintf("-oSetEnv %s", strings.Join(envs, " ")))
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

	cmd.SysProcAttr.AmbientCaps = grantCapSysPtrace(cmd.SysProcAttr.AmbientCaps)

	if s.cfg.WorkspaceLogRateLimit > 0 {
		limit := int64(s.cfg.WorkspaceLogRateLimit)
		cmd.Stderr = dropwriter.Writer(cmd.Stderr, dropwriter.NewBucket(limit*1024*3, limit*1024))
		log.WithField("limit_kb_per_sec", limit).Info("rate limiting SSH log output")
	}
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

func ensureSSHDir(cfg *Config) error {
	home := "/home/gitpod"

	d := filepath.Join(home, ".ssh")
	err := os.MkdirAll(d, 0o700)
	if err != nil {
		return xerrors.Errorf("cannot create $HOME/.ssh: %w", err)
	}
	_ = exec.Command("chown", "-R", fmt.Sprintf("%d:%d", gitpodUID, gitpodGID), d).Run()

	return nil
}

func ensurePrivsepDir() error {
	// Privilege separation, or privsep, is method in OpenSSH by which
	// operations that require root privilege are performed by a separate
	// privileged monitor process.
	// see detail: https://github.com/openssh/openssh-portable/blob/master/README.privsep
	privsepPath := "/var/empty"
	err := os.MkdirAll(privsepPath, 0o755)
	if err != nil {
		return xerrors.Errorf("cannot create privsep path: %w", err)
	}
	return nil
}

func ensureSSHCAFile(cfg *Config, caPath string) error {
	if cfg.SSHGatewayCAPublicKey == "" {
		return nil
	}
	err := os.WriteFile(caPath, []byte(cfg.SSHGatewayCAPublicKey), 0o644)
	if err != nil {
		return xerrors.Errorf("cannot write ssh ca pem: %w", err)
	}
	return nil
}

func configureSSHDefaultDir(cfg *Config) {
	if cfg.RepoRoot == "" {
		log.Error("cannot configure ssh default dir with empty repo root")
		return
	}
	file, err := os.OpenFile("/home/gitpod/.bash_profile", os.O_WRONLY|os.O_APPEND|os.O_CREATE, 0o644)
	if err != nil {
		log.WithError(err).Error("cannot write .bash_profile")
	}
	defer file.Close()
	if _, err := file.WriteString(fmt.Sprintf("\nif [[ -n $SSH_CONNECTION ]]; then cd \"%s\"; fi\n", cfg.RepoRoot)); err != nil {
		log.WithError(err).Error("write .bash_profile failed")
	}
}

func configureSSHMessageOfTheDay() {
	msg := []byte(`Welcome to Gitpod: Always ready to code. Try the following commands to get started:

	gp tasks list         List all your defined tasks in .gitpod.yml
	gp tasks attach       Attach your terminal to a workspace task

	gp ports list         Lists workspace ports and their states
	gp stop               Stop current workspace
	gp help               To learn about the gp CLI commands

For more information, see the Gitpod documentation: https://gitpod.io/docs
`)

	if err := ioutil.WriteFile("/etc/motd", msg, 0o644); err != nil {
		log.WithError(err).Error("write /etc/motd failed")
	}
}
