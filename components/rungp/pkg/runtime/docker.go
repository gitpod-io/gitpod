// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
)

type DockerRuntime struct {
	Workdir string
}

func (dr DockerRuntime) StartWorkspace(ctx context.Context, logs io.WriteCloser, workspaceImage string, cfg *gitpod.GitpodConfig) error {
	defer logs.Close()

	checkoutLocation := cfg.CheckoutLocation
	if checkoutLocation == "" {
		checkoutLocation = filepath.Base(dr.Workdir)
	}

	name := fmt.Sprintf("rungp-%d", time.Now().UnixNano())
	args := []string{"run", "--rm", "--user", "root", "--privileged", "-p", "8080:22999", "-v", fmt.Sprintf("%s:%s", dr.Workdir, filepath.Join("/workspace", checkoutLocation)), "--name", name}

	tasks, err := json.Marshal(cfg.Tasks)
	if err != nil {
		return err
	}

	envs := map[string]string{
		"GITPOD_WORKSPACE_URL":           "http://localhost",
		"GITPOD_THEIA_PORT":              "23000",
		"GITPOD_IDE_ALIAS":               "code",
		"THEIA_WORKSPACE_ROOT":           filepath.Join("/workspace", cfg.WorkspaceLocation),
		"GITPOD_REPO_ROOT":               filepath.Join("/workspace", checkoutLocation),
		"GITPOD_PREVENT_METADATA_ACCESS": "false",
		"GITPOD_WORKSPACE_ID":            "a-random-name",
		"GITPOD_TASKS":                   string(tasks),
		"GITPOD_HEADLESS":                "false",
		"GITPOD_HOST":                    "gitpod.local",
		"THEIA_SUPERVISOR_TOKENS":        `{"token": "invalid","kind": "gitpod","host": "gitpod.local","scope": [],"expiryDate": ` + time.Now().Format(time.RFC3339) + `,"reuse": 2}`,
		"VSX_REGISTRY_URL":               "https://https://open-vsx.org/",
	}
	tmpf, err := ioutil.TempFile("", "rungp-*.env")
	if err != nil {
		return err
	}
	for k, v := range envs {
		tmpf.WriteString(fmt.Sprintf("%s=%s\n", k, v))
	}
	tmpf.Close()
	args = append(args, "--env-file", tmpf.Name())
	defer os.Remove(tmpf.Name())

	for _, p := range cfg.Ports {
		args = append(args, "-p", fmt.Sprintf("%d:%d", p.Port, p.Port))
	}

	args = append(args, workspaceImage)
	args = append(args, "/.supervisor/supervisor", "run", "--rungp")

	cmd := exec.Command("docker", args...)
	cmd.Dir = dr.Workdir
	cmd.Stdout = logs
	cmd.Stderr = logs

	go func() {
		<-ctx.Done()
		if cmd.Process != nil {
			cmd.Process.Kill()
		}

		exec.Command("docker", "kill", name).CombinedOutput()
	}()

	return cmd.Run()
}
