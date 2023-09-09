// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package builder

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"

	"github.com/docker/cli/cli/config/configfile"
	"github.com/docker/cli/cli/config/types"
	"github.com/moby/buildkit/client"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
)

const (
	buildkitdSocketPath = "unix:///run/buildkit/buildkitd.sock"
	// maxConnectionAttempts is the number of attempts to try to connect to the buildkit daemon.
	// Uses exponential backoff to retry. 8 attempts is a bit over 4 minutes.
	maxConnectionAttempts    = 8
	initialConnectionTimeout = 2 * time.Second
)

// Builder builds images using buildkit
type Builder struct {
	Config *Config
}

// Build runs the actual image build
func (b *Builder) Build() error {
	var (
		cl       *client.Client
		teardown func() error = func() error { return nil }
		err      error
	)
	if b.Config.ExternalBuildkitd != "" {
		log.WithField("socketPath", b.Config.ExternalBuildkitd).Info("using external buildkit daemon")
		cl, err = connectToBuildkitd(b.Config.ExternalBuildkitd)

		if err != nil {
			log.Warn("cannot connect to node-local buildkitd - falling back to pod-local one")
			cl, teardown, err = StartBuildkit(buildkitdSocketPath)
		}
	} else {
		cl, teardown, err = StartBuildkit(buildkitdSocketPath)
	}
	if err != nil {
		return err
	}
	defer teardown()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = b.buildBaseLayer(ctx, cl)
	if err != nil {
		return err
	}
	err = b.buildWorkspaceImage(ctx, cl)
	if err != nil {
		return err
	}

	if b.Config.BuildSOCIIndex {
		err := buildSociIndex(ctx, cl, b.Config.TargetRef, b.Config.WorkspaceLayerAuth)
		if err != nil {
			log.WithError(err).Error("running SOCI command")
			return err
		}
	}

	return nil
}

func (b *Builder) buildBaseLayer(ctx context.Context, cl *client.Client) error {
	if !b.Config.BuildBase {
		return nil
	}

	log.Info("building base image")
	return buildImage(ctx, b.Config.ContextDir, b.Config.Dockerfile, b.Config.WorkspaceLayerAuth, b.Config.BaseRef)
}

func (b *Builder) buildWorkspaceImage(ctx context.Context, cl *client.Client) (err error) {
	log.Info("building workspace image")

	contextDir, err := os.MkdirTemp("", "wsimg-*")
	if err != nil {
		return err
	}

	dockerFile := `#
FROM %v
LABEL org.opencontainers.image.authors="GitpodImageBuilder"
`

	err = ioutil.WriteFile(filepath.Join(contextDir, "Dockerfile"), []byte(fmt.Sprintf(dockerFile, b.Config.BaseRef)), 0644)
	if err != nil {
		return xerrors.Errorf("unexpected error creating temporal directory: %w", err)
	}

	return buildImage(ctx, contextDir, filepath.Join(contextDir, "Dockerfile"), b.Config.WorkspaceLayerAuth, b.Config.TargetRef)
}

func buildSociIndex(ctx context.Context, cl *client.Client, targetRef, authLayer string) error {
	err := runSociCmd("create", targetRef)
	if err != nil {
		return xerrors.Errorf("unexpected error creating SOCI index")
	}

	dockerConfig := "/tmp/config.json"
	defer os.Remove(dockerConfig)

	if authLayer != "" {
		err := buildDockerConfig(dockerConfig, authLayer)
		if err != nil {
			return xerrors.Errorf("unexpected error writing registry authentication: %w", err)
		}
	}

	err = runSociCmd("push", "--plain-http", targetRef)
	if err != nil {
		return xerrors.Errorf("unexpected error creating SOCI index")
	}

	return nil
}

func runSociCmd(cmd string, cmdArgs ...string) error {
	args := []string{"--namespace", "buildkit", cmd}
	args = append(args, cmdArgs...)
	log.WithField("args", args).Info("executing soci command")
	sociCmd := exec.Command("soci", args...)
	sociCmd.Stderr = os.Stderr
	sociCmd.Stdout = os.Stdout

	env := os.Environ()
	env = append(env, "DOCKER_CONFIG=/tmp")
	sociCmd.Env = env

	if err := sociCmd.Start(); err != nil {
		return err
	}

	return sociCmd.Wait()
}

func buildImage(ctx context.Context, contextDir, dockerfile, authLayer, target string) (err error) {
	log.Info("waiting for build context")
	waitctx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()

	err = waitForBuildContext(waitctx)
	if err != nil {
		return err
	}

	dockerConfig := "/tmp/config.json"
	defer os.Remove(dockerConfig)

	if authLayer != "" {
		err := buildDockerConfig(dockerConfig, authLayer)
		if err != nil {
			return xerrors.Errorf("unexpected error writing registry authentication: %w", err)
		}
	}

	contextdir := contextDir
	if contextdir == "" {
		contextdir = "."
	}

	buildctlArgs := []string{
		"build",
		"--progress=plain",
		"--output=type=image,name=" + target + ",push=true,oci-mediatypes=true,force-compression=true",
		"--local=context=" + contextdir,
		"--frontend=dockerfile.v0",
		"--local=dockerfile=" + filepath.Dir(dockerfile),
		"--opt=filename=" + filepath.Base(dockerfile),
	}

	buildctlCmd := exec.Command("buildctl", buildctlArgs...)

	buildctlCmd.Stderr = os.Stderr
	buildctlCmd.Stdout = os.Stdout

	env := os.Environ()
	env = append(env, "DOCKER_CONFIG=/tmp")
	// set log max size to 4MB from 2MB default (to prevent log clipping for large builds)
	env = append(env, "BUILDKIT_STEP_LOG_MAX_SIZE=4194304")
	buildctlCmd.Env = env

	if err := buildctlCmd.Start(); err != nil {
		return err
	}

	err = buildctlCmd.Wait()
	if err != nil {
		return err
	}

	return nil
}

func buildDockerConfig(location, authLayer string) error {
	configFile := configfile.ConfigFile{
		AuthConfigs: make(map[string]types.AuthConfig),
	}

	err := configFile.LoadFromReader(bytes.NewReader([]byte(fmt.Sprintf(`{"auths": %v }`, authLayer))))
	if err != nil {
		return xerrors.Errorf("unexpected error reading registry authentication: %w", err)
	}

	f, _ := os.OpenFile(location, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	defer f.Close()

	err = configFile.SaveToWriter(f)
	if err != nil {
		return xerrors.Errorf("unexpected error writing registry authentication: %w", err)
	}

	return nil
}

func waitForBuildContext(ctx context.Context) error {
	done := make(chan struct{})

	go func() {
		for {
			if ctx.Err() != nil {
				return
			}

			if _, err := os.Stat("/workspace/.gitpod/ready"); err != nil {
				continue
			}

			close(done)
			return
		}
	}()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-done:
		return nil
	}
}

// StartBuildkit starts a local buildkit daemon
func StartBuildkit(socketPath string) (cl *client.Client, teardown func() error, err error) {
	stderr, err := ioutil.TempFile(os.TempDir(), "buildkitd_stderr")
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot create buildkitd log file: %w", err)
	}
	stdout, err := ioutil.TempFile(os.TempDir(), "buildkitd_stdout")
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot create buildkitd log file: %w", err)
	}

	cmd := exec.Command("buildkitd",
		"--debug",
		"--addr="+socketPath,
		"--containerd-worker=true", "--oci-worker=false",
		"--root=/workspace/buildkit",
	)
	cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: 0, Gid: 0}}
	cmd.Stderr = stderr
	cmd.Stdout = stdout
	err = cmd.Start()
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot start buildkitd: %w", err)
	}
	log.WithField("stderr", stderr.Name()).WithField("stdout", stdout.Name()).Debug("buildkitd started")

	defer func() {
		if err == nil {
			return
		}

		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}

		serr, _ := ioutil.ReadFile(stderr.Name())
		sout, _ := ioutil.ReadFile(stdout.Name())

		log.WithField("buildkitd-stderr", string(serr)).WithField("buildkitd-stdout", string(sout)).Error("buildkitd failure")
	}()

	containerdStderr, err := ioutil.TempFile(os.TempDir(), "containerd_stderr")
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot create containerd log file: %w", err)
	}
	containerdStdout, err := ioutil.TempFile(os.TempDir(), "containerd_stdout")
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot create containerd log file: %w", err)
	}

	containerdCmd := exec.Command("containerd")
	containerdCmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: 0, Gid: 0}}
	containerdCmd.Stderr = containerdStderr
	containerdCmd.Stdout = containerdStdout
	err = containerdCmd.Start()
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot start containerd: %w", err)
	}
	log.WithField("stderr", stderr.Name()).WithField("stdout", stdout.Name()).Debug("containerd started")

	defer func() {
		if err == nil {
			return
		}

		if containerdCmd.Process != nil {
			_ = containerdCmd.Process.Kill()
		}

		serr, _ := ioutil.ReadFile(containerdStderr.Name())
		sout, _ := ioutil.ReadFile(containerdStdout.Name())

		log.WithField("containerd-stderr", string(serr)).WithField("containerd-stdout", string(sout)).Error("containerd failure")
	}()

	teardown = func() error {
		stdout.Close()
		stderr.Close()
		_ = containerdCmd.Process.Kill()
		containerdStdout.Close()
		containerdStderr.Close()

		return cmd.Process.Kill()
	}

	cl, err = connectToBuildkitd(socketPath)
	if err != nil {
		return
	}

	return
}

func connectToBuildkitd(socketPath string) (cl *client.Client, err error) {
	backoff := 1 * time.Second
	for i := 0; i < maxConnectionAttempts; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), initialConnectionTimeout)

		log.WithField("attempt", i).Debug("attempting to connect to buildkitd")
		cl, err = client.New(ctx, socketPath, client.WithFailFast())
		if err != nil {
			cancel()
			if i == maxConnectionAttempts-1 {
				log.WithField("attempt", i).WithError(err).Warn("cannot connect to buildkitd")
				break
			}

			time.Sleep(backoff)
			backoff = 2 * backoff
			continue
		}

		_, err = cl.ListWorkers(ctx)
		if err != nil {
			cancel()
			if i == maxConnectionAttempts-1 {
				log.WithField("attempt", i).WithError(err).Error("cannot connect to buildkitd")
				break
			}

			time.Sleep(backoff)
			backoff = 2 * backoff
			continue
		}

		cancel()
		return
	}

	return nil, xerrors.Errorf("cannot connect to buildkitd")
}
