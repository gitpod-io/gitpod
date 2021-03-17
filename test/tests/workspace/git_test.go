// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace_test

import (
	"net/rpc"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"github.com/gitpod-io/gitpod/test/tests/workspace/common"
	agent "github.com/gitpod-io/gitpod/test/tests/workspace/workspace_agent/api"
)

type GitTest struct {
	Skip          bool
	Name          string
	ContextURL    string
	WorkspaceRoot string
	Action        GitFunc
}

type GitFunc func(rsa *rpc.Client, git common.GitClient, workspaceRoot string) error

func TestGitActions(t *testing.T) {
	tests := []GitTest{
		{
			Name:          "create, add and commit",
			ContextURL:    "github.com/gitpod-io/gitpod-test-repo/tree/integration-test/commit-and-push",
			WorkspaceRoot: "/workspace/gitpod-test-repo",
			Action: func(rsa *rpc.Client, git common.GitClient, workspaceRoot string) (err error) {

				var resp agent.ExecResponse
				err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
					Dir:     workspaceRoot,
					Command: "bash",
					Args: []string{
						"-c",
						"echo \"another test run...\" >> file_to_commit.txt",
					},
				}, &resp)
				if err != nil {
					return err
				}
				err = git.Add(workspaceRoot)
				if err != nil {
					return err
				}
				err = git.Commit(workspaceRoot, "automatic test commit", false)
				if err != nil {
					return err
				}
				return nil
			},
		},
		{
			Skip:          true,
			Name:          "create, add and commit and PUSH",
			ContextURL:    "github.com/gitpod-io/gitpod-test-repo/tree/integration-test/commit-and-push",
			WorkspaceRoot: "/workspace/gitpod-test-repo",
			Action: func(rsa *rpc.Client, git common.GitClient, workspaceRoot string) (err error) {

				var resp agent.ExecResponse
				err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
					Dir:     workspaceRoot,
					Command: "bash",
					Args: []string{
						"-c",
						"echo \"another test run...\" >> file_to_commit.txt",
					},
				}, &resp)
				if err != nil {
					return err
				}
				err = git.Add(workspaceRoot)
				if err != nil {
					return err
				}
				err = git.Commit(workspaceRoot, "automatic test commit", false)
				if err != nil {
					return err
				}
				err = git.Push(workspaceRoot, false)
				if err != nil {
					return err
				}
				return nil
			},
		},
	}
	runGitTests(t, tests)
}

func runGitTests(t *testing.T, tests []GitTest) {
	for _, test := range tests {
		t.Run(test.ContextURL, func(t *testing.T) {
			if test.Skip {
				t.SkipNow()
			}

			it, ctx := integration.NewTest(t, 5*time.Minute)
			defer it.Done()

			nfo, stopWS := integration.LaunchWorkspaceFromContextURL(it, test.ContextURL)
			defer stopWS(false)

			it.WaitForWorkspace(ctx, nfo.LatestInstance.ID)

			rsa, err := it.Instrument(integration.ComponentWorkspace, "workspace", integration.WithInstanceID(nfo.LatestInstance.ID))
			if err != nil {
				t.Fatal(err)
			}
			defer rsa.Close()

			git := common.Git(rsa)
			test.Action(rsa, git, test.WorkspaceRoot)

			rsa.Close()
		})
	}
}
