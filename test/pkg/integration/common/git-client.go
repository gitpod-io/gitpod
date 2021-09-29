// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	"net/rpc"
	"strings"

	"golang.org/x/xerrors"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
)

type GitClient struct {
	*rpc.Client
}

func Git(rsa *rpc.Client) GitClient {
	return GitClient{rsa}
}

func (g GitClient) GetBranch(workspaceRoot string) (string, error) {
	var resp agent.ExecResponse
	err := g.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     workspaceRoot,
		Command: "git",
		Args:    []string{"rev-parse", "--abbrev-ref", "HEAD"},
	}, &resp)
	if err != nil {
		return "", xerrors.Errorf("getBranch error: %w", err)
	}
	if resp.ExitCode != 0 {
		return "", xerrors.Errorf("getBranch rc!=0: %d", resp.ExitCode)
	}
	return strings.Trim(resp.Stdout, " \t\n"), nil
}

func (g GitClient) Add(dir string, files ...string) error {
	args := []string{"add"}
	if files == nil {
		args = append(args, ".")
	} else {
		args = append(args, files...)
	}
	var resp agent.ExecResponse
	err := g.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     dir,
		Command: "git",
		Args:    args,
	}, &resp)
	if err != nil {
		return err
	}
	if resp.ExitCode != 0 {
		return xerrors.Errorf("commit returned rc: %d", resp.ExitCode)
	}
	return nil
}

func (g GitClient) Commit(dir string, message string, all bool) error {
	args := []string{"commit", "-m", message}
	if all {
		args = append(args, "--all")
	}
	var resp agent.ExecResponse
	err := g.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     dir,
		Command: "git",
		Args:    args,
	}, &resp)
	if err != nil {
		return err
	}
	if resp.ExitCode != 0 {
		return xerrors.Errorf("commit returned rc: %d", resp.ExitCode)
	}
	return nil
}

func (g GitClient) Push(dir string, force bool, moreArgs ...string) error {
	args := []string{"push"}
	if moreArgs != nil {
		args = append(args, moreArgs...)
	}
	if force {
		args = append(args, "--force")
	}
	var resp agent.ExecResponse
	err := g.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     dir,
		Command: "git",
		Args:    args,
	}, &resp)
	if err != nil {
		return err
	}
	if resp.ExitCode != 0 {
		return xerrors.Errorf("commit returned rc: %d", resp.ExitCode)
	}
	return nil
}
