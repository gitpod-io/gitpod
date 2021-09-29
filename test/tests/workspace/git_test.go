// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"net/rpc"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"github.com/gitpod-io/gitpod/test/tests/workspace/common"
)

//
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

	f := features.New("GitActions").
		WithLabel("component", "server").
		Assess("it can run git actions", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			for _, test := range tests {
				t.Run(test.ContextURL, func(t *testing.T) {
					if test.Skip {
						t.SkipNow()
					}

					nfo, stopWS, err := integration.LaunchWorkspaceFromContextURL(ctx, test.ContextURL, username, api)
					if err != nil {
						t.Fatal(err)
					}

					defer stopWS(false)

					_, err = integration.WaitForWorkspaceStart(ctx, nfo.LatestInstance.ID, api)
					if err != nil {
						t.Fatal(err)
					}

					rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), cfg.Client(), integration.WithInstanceID(nfo.LatestInstance.ID))
					if err != nil {
						t.Fatal(err)
					}
					defer rsa.Close()
					integration.DeferCloser(t, closer)

					git := common.Git(rsa)
					err = test.Action(rsa, git, test.WorkspaceRoot)
					if err != nil {
						t.Fatal(err)
					}
				})
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
