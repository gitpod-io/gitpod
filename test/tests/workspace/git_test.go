// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"net/rpc"
	"path/filepath"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/git"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"github.com/gitpod-io/gitpod/test/tests/workspace/common"
)

//
type GitTest struct {
	Skip   bool
	Name   string
	Action GitFunc
}

type GitFunc func(rsa *rpc.Client, git common.GitClient, workspaceRoot string) error

func TestGitActions(t *testing.T) {
	integration.SkipWithoutUsername(t, username)
	tests := []GitTest{
		{
			Name: "create, add and commit",
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
			Skip: false,
			Name: "create, add and commit and PUSH",
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

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			for _, test := range tests {
				t.Run(test.Name, func(t *testing.T) {
					if test.Skip {
						t.SkipNow()
					}

					tkn, err := integration.GitHubToken(ctx, username, api)
					if err != nil {
						t.Fatal(err)
					}
					repo, err := git.MaterialiseToGitHub(ctx, tkn, "", git.TempRepo(true), git.Ops{
						git.OpAddFile("README", "nothing to see here"),
						git.OpCommitAll("initial commit"),
					})
					if err != nil {
						t.Fatal(err)
					}
					t.Cleanup(func() {
						repo.Delete(ctx)
					})

					nfo, stopWS, err := integration.LaunchWorkspaceFromContextURL(ctx, repo.ContextURL(), username, api)
					if err != nil {
						t.Fatal(err)
					}

					defer stopWS(false)

					_, err = integration.WaitForWorkspaceStart(ctx, nfo.LatestInstance.ID, api)
					if err != nil {
						t.Fatal(err)
					}

					rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(), integration.WithInstanceID(nfo.LatestInstance.ID))
					if err != nil {
						t.Fatal(err)
					}
					defer rsa.Close()
					integration.DeferCloser(t, closer)

					workspaceRoot := filepath.Join("/workspace", *repo.Remote.Name)

					git := common.Git(rsa)
					err = test.Action(rsa, git, workspaceRoot)
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
