// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

type GitTest struct {
	Skip          bool
	Name          string
	ContextURL    string
	WorkspaceRoot string
	Action        GitFunc
}

type GitFunc func(rsa *integration.RpcClient, git integration.GitClient, workspaceRoot string) error

func TestGitActions(t *testing.T) {
	userToken, _ := os.LookupEnv("USER_TOKEN")
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)

	tests := []GitTest{
		{
			Name:          "create, add and commit",
			ContextURL:    "github.com/gitpod-io/gitpod-test-repo/tree/integration-test/commit",
			WorkspaceRoot: "/workspace/gitpod-test-repo",
			Action: func(rsa *integration.RpcClient, git integration.GitClient, workspaceRoot string) (err error) {
				var resp agent.ExecResponse
				err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
					Dir:     workspaceRoot,
					Command: "bash",
					Args: []string{
						"-c",
						"touch file_to_commit.txt",
					},
				}, &resp)
				if err != nil {
					return err
				}
				if resp.ExitCode != 0 {
					return fmt.Errorf("file create returned rc: %d, out: %v, err: %v", resp.ExitCode, resp.Stdout, resp.Stderr)
				}
				err = git.ConfigSafeDirectory()
				if err != nil {
					return err
				}
				err = git.ConfigUserName(workspaceRoot, username)
				if err != nil {
					return err
				}
				err = git.ConfigUserEmail(workspaceRoot)
				if err != nil {
					return err
				}
				err = git.Add(workspaceRoot)
				if err != nil {
					return err
				}
				err = git.Commit(workspaceRoot, "automatic test commit", false, "--allow-empty")
				if err != nil {
					return err
				}
				return nil
			},
		},
		{
			// as of Apr 14, 2023, test fails with:
			// fatal: could not read Username for 'https://github.com': No such device or address
			Skip:          true,
			Name:          "create, add and commit and PUSH",
			ContextURL:    "github.com/gitpod-io/gitpod-test-repo/tree/integration-test/commit-and-push",
			WorkspaceRoot: "/workspace/gitpod-test-repo",
			Action: func(rsa *integration.RpcClient, git integration.GitClient, workspaceRoot string) (err error) {
				var resp agent.ExecResponse
				err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
					Dir:     workspaceRoot,
					Command: "bash",
					Args: []string{
						"-c",
						"touch file_to_commit.txt",
					},
				}, &resp)
				if err != nil {
					return err
				}
				if resp.ExitCode != 0 {
					return fmt.Errorf("file create returned rc: %d, out: %v, err: %v", resp.ExitCode, resp.Stdout, resp.Stderr)
				}
				err = git.ConfigSafeDirectory()
				if err != nil {
					return err
				}
				err = git.ConfigUserName(workspaceRoot, username)
				if err != nil {
					return err
				}
				err = git.ConfigUserEmail(workspaceRoot)
				if err != nil {
					return err
				}
				err = git.Add(workspaceRoot)
				if err != nil {
					return err
				}
				err = git.Commit(workspaceRoot, "automatic test commit", false, "--allow-empty")
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
		WithLabel("component", "workspace").
		Assess("it can run git actions", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), time.Duration(5*len(tests))*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			ffs := []struct {
				Name string
				FF   string
			}{
				{Name: "classic"},
				// {Name: "pvc", FF: "persistent_volume_claim"},
			}

			for _, ff := range ffs {
				for _, test := range tests {
					test := test
					t.Run(test.ContextURL+"_"+ff.Name, func(t *testing.T) {
						t.Parallel()
						if test.Skip {
							t.SkipNow()
						}

						username := username + ff.Name
						userId, err := api.CreateUser(username, userToken)
						if err != nil {
							t.Fatal(err)
						}

						if err := api.UpdateUserFeatureFlag(userId, ff.FF); err != nil {
							t.Fatal(err)
						}

						nfo, stopWs, err := integration.LaunchWorkspaceFromContextURL(t, ctx, test.ContextURL, username, api)
						if err != nil {
							t.Fatal(err)
						}
						t.Cleanup(func() {
							sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
							defer scancel()

							sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
							defer sapi.Done(t)

							_, err := stopWs(true, sapi)
							if err != nil {
								t.Fatal(err)
							}
						})

						rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(), integration.WithInstanceID(nfo.LatestInstance.ID))
						if err != nil {
							t.Fatal(err)
						}
						defer rsa.Close()
						integration.DeferCloser(t, closer)

						git := integration.Git(rsa)
						err = test.Action(rsa, git, test.WorkspaceRoot)
						if err != nil {
							t.Fatal(err)
						}
					})
				}
			}
			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
