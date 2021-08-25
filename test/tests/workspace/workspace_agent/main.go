// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"github.com/gitpod-io/gitpod/test/tests/workspace/workspace_agent/api"
)

func main() {
	integration.ServeAgent(new(WorkspaceAgent))
}

// WorkspaceAgent provides ingteration test services from within a workspace
type WorkspaceAgent struct {
}

// ListDir lists a directory's content
func (*WorkspaceAgent) ListDir(req *api.ListDirRequest, resp *api.ListDirResponse) error {
	dc, err := os.ReadDir(req.Dir)
	if err != nil {
		return err
	}

	*resp = api.ListDirResponse{}
	for _, c := range dc {
		resp.Files = append(resp.Files, c.Name())
	}
	return nil
}

// WriteFile writes a file in the workspace
func (*WorkspaceAgent) WriteFile(req *api.WriteFileRequest, resp *api.WriteFileResponse) (err error) {
	err = os.WriteFile(req.Path, req.Content, req.Mode)
	if err != nil {
		return
	}

	*resp = api.WriteFileResponse{}
	return
}

// Exec executes a command in the workspace
func (*WorkspaceAgent) Exec(req *api.ExecRequest, resp *api.ExecResponse) (err error) {
	cmd := exec.Command(req.Command, req.Args...)
	var (
		stdout bytes.Buffer
		stderr bytes.Buffer
	)
	if req.Dir != "" {
		cmd.Dir = req.Dir
	}
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err = cmd.Run()

	var rc int
	if err != nil {
		exitError, ok := err.(*exec.ExitError)
		if !ok {
			fullCommand := strings.Join(append([]string{req.Command}, req.Args...), " ")
			return xerrors.Errorf("%s: %w", fullCommand, err)
		}
		rc = exitError.ExitCode()
	}

	*resp = api.ExecResponse{
		ExitCode: rc,
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
	}
	return
}
