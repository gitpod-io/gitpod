// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

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

	"github.com/gitpod-io/gitpod/common-go/log"

	"github.com/docker/cli/cli/config/configfile"
	"github.com/docker/cli/cli/config/types"
	"github.com/moby/buildkit/client"
	"golang.org/x/xerrors"
)

const (
	buildkitdSocketPath      = "unix:///run/buildkit/buildkitd.sock"
	maxConnectionAttempts    = 10
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

	return nil
}

func (b *Builder) buildBaseLayer(ctx context.Context, cl *client.Client) error {
	if !b.Config.BuildBase {
		return nil
	}

	log.Info("building base image")
	return buildImage(ctx, b.Config.ContextDir, b.Config.Dockerfile, b.Config.WorkspaceLayerAuth, b.Config.BaseRef, b.Config.TargetRef)
}

func (b *Builder) buildWorkspaceImage(ctx context.Context, cl *client.Client) (err error) {
	log.Info("building workspace image")

	contextDir := b.Config.ContextDir
	dockerfile := b.Config.Dockerfile

	if _, err := os.Stat(dockerfile); os.IsNotExist(err) {
		contextDir = "/workspace"
		dockerfile = "Dockerfile"

		err = ioutil.WriteFile(filepath.Join(contextDir, "Dockerfile"), []byte(fmt.Sprintf("FROM %v", b.Config.BaseRef)), 0644)
		if err != nil {
			return xerrors.Errorf("unexpected error creating temporal directory: %w", err)
		}
	}

	return buildImage(ctx, contextDir, dockerfile, b.Config.WorkspaceLayerAuth, b.Config.BaseRef, b.Config.TargetRef)
}

func buildImage(ctx context.Context, contextDir, dockerfile, authLayer, source, target string) error {
	log.Info("waiting for build context")
	waitctx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()

	err := waitForBuildContext(waitctx)
	if err != nil {
		return err
	}

	dockerConfig := "/tmp/config.json"
	defer os.Remove(dockerConfig)

	if authLayer != "" {
		configFile := configfile.ConfigFile{
			AuthConfigs: make(map[string]types.AuthConfig),
		}

		err := configFile.LoadFromReader(bytes.NewReader([]byte(fmt.Sprintf(`{"auths": %v }`, authLayer))))
		if err != nil {
			return xerrors.Errorf("unexpected error reading registry authentication: %w", err)
		}

		f, _ := os.OpenFile(dockerConfig, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
		defer f.Close()

		err = configFile.SaveToWriter(f)
		if err != nil {
			return xerrors.Errorf("unexpected error writing registry authentication: %w", err)
		}
	}

	contextdir := contextDir
	if contextdir == "" {
		contextdir = "."
	}

	buildctlArgs := []string{
		"--debug",
		"build",
		"--progress=plain",
		"--output=type=image,name=" + target + ",push=true,oci-mediatypes=true,compression=estargz",
		"--local=context=" + contextdir,
		//"--export-cache=type=registry,ref=" + target + "-cache",
		//"--import-cache=type=registry,ref=" + target + "-cache",
		"--frontend=dockerfile.v0",
		"--local=dockerfile=" + filepath.Dir(dockerfile),
		"--opt=filename=" + filepath.Base(dockerfile),
	}

	buildctlCmd := exec.Command("buildctl", buildctlArgs...)
	buildctlCmd.Stderr = os.Stderr
	buildctlCmd.Stdout = os.Stdout

	env := os.Environ()
	env = append(env, "DOCKER_CONFIG=/tmp")
	buildctlCmd.Env = env

	if err := buildctlCmd.Start(); err != nil {
		return err
	}

	if err := buildctlCmd.Wait(); err != nil {
		return err
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
		"--oci-worker-net=host", "--oci-worker-snapshotter=stargz",
		"--root=/workspace/buildkit",
	)
	cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: 0, Gid: 0}}
	cmd.Stderr = stderr
	cmd.Stdout = stdout
	err = cmd.Start()
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot start buildkitd: %w", err)
	}

	defer func() {
		if err == nil {
			return
		}

		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}

		stderr.Close()
		stdout.Close()

		serr, _ := ioutil.ReadFile(stderr.Name())
		sout, _ := ioutil.ReadFile(stdout.Name())

		log.WithField("buildkitd-stderr", string(serr)).WithField("buildkitd-stdout", string(sout)).Error("buildkitd failure")
	}()

	teardown = func() error {
		stdout.Close()
		stderr.Close()
		return cmd.Process.Kill()
	}
	cl, err = connectToBuildkitd(socketPath)
	if err != nil {
		return
	}

	return
}

func connectToBuildkitd(socketPath string) (cl *client.Client, err error) {
	for i := 0; i < maxConnectionAttempts; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), initialConnectionTimeout)

		log.WithField("attempt", i).Debug("attempting to connect to buildkitd")
		cl, err = client.New(ctx, socketPath, client.WithFailFast())
		if err != nil {
			if i == maxConnectionAttempts-1 {
				log.WithField("attempt", i).WithError(err).Warn("cannot connect to buildkitd")
			}

			cancel()
			time.Sleep(1 * time.Second)
			continue
		}

		_, err = cl.ListWorkers(ctx)
		if err != nil {
			if i == maxConnectionAttempts-1 {
				log.WithField("attempt", i).WithError(err).Error("cannot connect to buildkitd")
			}

			cancel()
			time.Sleep(1 * time.Second)
			continue
		}

		cancel()
		return
	}

	return nil, xerrors.Errorf("cannot connect to buildkitd")
}
