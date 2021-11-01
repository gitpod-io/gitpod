// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:build !docker

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
	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/xerrors"
)

func buildImage(ctx context.Context, contextDir, dockerfile, authLayer, target string) error {
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
		"--output=type=image,name=" + target + ",push=true,oci-mediatypes=true", //,compression=estargz",
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

// StartBuildDaemon starts a local buildkit daemon
func StartBuildDaemon(socketPath string) (teardown func() error, err error) {
	stderr, err := ioutil.TempFile(os.TempDir(), "buildkitd_stderr")
	if err != nil {
		return nil, xerrors.Errorf("cannot create buildkitd log file: %w", err)
	}
	stdout, err := ioutil.TempFile(os.TempDir(), "buildkitd_stdout")
	if err != nil {
		return nil, xerrors.Errorf("cannot create buildkitd log file: %w", err)
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
		return nil, xerrors.Errorf("cannot start buildkitd: %w", err)
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

	return
}
