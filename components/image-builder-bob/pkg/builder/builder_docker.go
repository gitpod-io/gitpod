// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

//go:build docker

package builder

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
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

		f, err := os.OpenFile(dockerConfig, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
		if err != nil {
			return xerrors.Errorf("cannot write docker config file: %w", err)
		}
		defer f.Close()

		err = configFile.SaveToWriter(f)
		if err != nil {
			return xerrors.Errorf("unexpected error writing registry authentication: %w", err)
		}
	}

	args := []string{
		"--config", "/tmp",
		"build",
		"--tag", target,
		"--file", dockerfile,
		".",
	}
	cmd := exec.Command("docker", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Dir = contextDir
	return cmd.Run()
}

func StartBuildDaemon(socketPath string) (teardown func() error, err error) {
	// nothing to do here because Docker is socket activated in a Gitpod workspace
	return func() error { return nil }, nil
}
