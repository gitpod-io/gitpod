// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package builder

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	toml "github.com/pelletier/go-toml"

	"github.com/moby/buildkit/client"
	"golang.org/x/xerrors"
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
			cl, teardown, err = StartBuildkit(buildkitdSocketPath, b.Config.WorkspaceLayerAuth)
		}
	} else {
		cl, teardown, err = StartBuildkit(buildkitdSocketPath, b.Config.WorkspaceLayerAuth)
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
	return buildImage(ctx, b.Config.ContextDir, b.Config.Dockerfile, b.Config.BaseRef)
}

func (b *Builder) buildWorkspaceImage(ctx context.Context, cl *client.Client) (err error) {
	log.Info("building workspace image")

	contextDir, err := os.MkdirTemp("", "wsimg-*")
	if err != nil {
		return err
	}

	err = ioutil.WriteFile(filepath.Join(contextDir, "Dockerfile"), []byte(fmt.Sprintf("FROM %v", b.Config.BaseRef)), 0644)
	if err != nil {
		return xerrors.Errorf("unexpected error creating temporal directory: %w", err)
	}

	return buildImage(ctx, contextDir, filepath.Join(contextDir, "Dockerfile"), b.Config.TargetRef)
}

func buildImage(ctx context.Context, contextDir, dockerfile, target string) (err error) {
	log.Info("waiting for build context")
	waitctx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()

	err = waitForBuildContext(waitctx)
	if err != nil {
		return err
	}

	contextdir := contextDir
	if contextdir == "" {
		contextdir = "."
	}

	buildctlArgs := []string{
		// "--debug",
		"build",
		"--progress=plain",
		"--output=type=image,name=" + target + ",push=true,oci-mediatypes=true",
		//"--export-cache=type=inline",
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
func StartBuildkit(socketPath string, authLayer string) (cl *client.Client, teardown func() error, err error) {
	stderr, err := ioutil.TempFile(os.TempDir(), "buildkitd_stderr")
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot create buildkitd log file: %w", err)
	}
	stdout, err := ioutil.TempFile(os.TempDir(), "buildkitd_stdout")
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot create buildkitd log file: %w", err)
	}

	buildkitCfg, err := createBuildkitConfig(authLayer)
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot create buildkitd config: %w", err)
	}
	buildkitCfgData, err := toml.Marshal(buildkitCfg)
	if err != nil {
		return nil, nil, xerrors.Errorf("cannot marshal buildkitd config: %w", err)
	}
	buildkitCfgFile := "/etc/buildkitd.toml"
	f, err := os.Create(buildkitCfgFile)
	defer f.Close()
	if err != nil {
		return nil, nil, xerrors.Errorf("unexpected error creating buildkitd config file: %w", err)
	}
	_, err = f.Write(buildkitCfgData)
	if err != nil {
		return nil, nil, xerrors.Errorf("unexpected error writing buildkitd config file: %w", err)
	}

	cmd := exec.Command("buildkitd",
		"--config"+buildkitCfgFile,
		"--debug",
		"--addr="+socketPath,
		"--oci-worker-net=host",
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

type BuildkitConfig struct {
	Registry map[string]RegistryConfig `toml:"registry"`
}
type RegistryConfig struct {
	Mirrors   *[]string `toml:"mirrors"`
	PlainHttp *bool     `toml:"http"`
}

func createBuildkitConfig(authLayer string) (buildkitConfig BuildkitConfig, err error) {
	registryConfig := make(map[string]RegistryConfig)

	registries := []string{}

	err = json.Unmarshal([]byte(authLayer), &registries)
	if err != nil {
		return buildkitConfig, xerrors.Errorf("unexpected error reading registry authentication: %w", err)
	}

	t := true
	for _, host := range registries {
		if host != "" {
			registryConfig[host] = RegistryConfig{
				Mirrors: &[]string{"localhost:8080"},
			}
		}
	}

	registryConfig["localhost:8080"] = RegistryConfig{
		PlainHttp: &t,
	}
	return BuildkitConfig{
		Registry: registryConfig,
	}, nil
}
