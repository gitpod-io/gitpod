// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package integration

import (
	"fmt"
	"strings"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
)

type GitClient struct {
	rpcClient *RpcClient
}

func Git(rsa *RpcClient) GitClient {
	return GitClient{rsa}
}

func (g GitClient) GetBranch(workspaceRoot string, ignoreError bool) (string, error) {
	var resp agent.ExecResponse
	err := g.rpcClient.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     workspaceRoot,
		Command: "git",
		Args:    []string{"rev-parse", "--abbrev-ref", "HEAD"},
	}, &resp)
	if !ignoreError {
		if err != nil {
			return "", fmt.Errorf("getBranch error: %w", err)
		}
		if resp.ExitCode != 0 {
			return "", fmt.Errorf("getBranch returned rc: %d err: %v", resp.ExitCode, resp.Stderr)
		}
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
	err := g.rpcClient.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     dir,
		Command: "git",
		Args:    args,
	}, &resp)
	if err != nil {
		return err
	}
	if resp.ExitCode != 0 {
		return fmt.Errorf("add returned rc: %d err: %v", resp.ExitCode, resp.Stderr)
	}
	return nil
}

func (g GitClient) ConfigSafeDirectory() error {
	var resp agent.ExecResponse
	err := g.rpcClient.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Command: "git",
		Args:    []string{"config", "--global", "--add", "safe.directory", "'*'"},
	}, &resp)
	if err != nil {
		return err
	}
	if resp.ExitCode != 0 {
		return fmt.Errorf("config returned rc: %d err: %v", resp.ExitCode, resp.Stderr)
	}
	return nil
}

func (g GitClient) ConfigUserName(dir string, username string) error {
	var userName string
	if username == "" {
		userName = "integration-test"
	} else {
		userName = username
	}
	args := []string{"config", "--local", "user.name", userName}
	var resp agent.ExecResponse
	err := g.rpcClient.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     dir,
		Command: "git",
		Args:    args,
	}, &resp)
	if err != nil {
		return err
	}
	if resp.ExitCode != 0 {
		return fmt.Errorf("config user name returned rc: %d err: %v", resp.ExitCode, resp.Stderr)
	}
	return nil
}

func (g GitClient) ConfigUserEmail(dir string, files ...string) error {
	args := []string{"config", "--local", "user.email", "integration-test@gitpod.io"}
	var resp agent.ExecResponse
	err := g.rpcClient.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     dir,
		Command: "git",
		Args:    args,
	}, &resp)
	if err != nil {
		return err
	}
	if resp.ExitCode != 0 {
		return fmt.Errorf("config user email returned rc: %d err: %v", resp.ExitCode, resp.Stderr)
	}
	return nil
}

func (g GitClient) Commit(dir string, message string, all bool, moreArgs ...string) error {
	args := []string{"commit", "-m", message}
	if all {
		args = append(args, "--all")
	}
	if moreArgs != nil {
		args = append(args, moreArgs...)
	}
	var resp agent.ExecResponse
	err := g.rpcClient.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     dir,
		Command: "git",
		Args:    args,
	}, &resp)
	if err != nil {
		return err
	}
	if resp.ExitCode != 0 {
		return fmt.Errorf("commit returned rc: %d, out: %v, err: %v", resp.ExitCode, resp.Stdout, resp.Stderr)
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
	err := g.rpcClient.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     dir,
		Command: "git",
		Args:    args,
	}, &resp)
	if err != nil {
		return err
	}
	if resp.ExitCode != 0 {
		return fmt.Errorf("push returned rc: %d err: %v", resp.ExitCode, resp.Stderr)
	}
	return nil
}
