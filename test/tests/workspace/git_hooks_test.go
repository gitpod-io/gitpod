// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"os"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

const (
	FILE_CREATED_HOOKS = "output.txt"
)

type GitHooksTestCase struct {
	Name          string
	ContextURL    string
	WorkspaceRoot string
}

func TestGitHooks(t *testing.T) {
	userToken, _ := os.LookupEnv("USER_TOKEN")
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)

	tests := []GitHooksTestCase{
		{
			Name:          "husky",
			ContextURL:    "https://github.com/gitpod-io/gitpod-test-repo/tree/husky",
			WorkspaceRoot: "/workspace/gitpod-test-repo",
		},
	}

	f := features.New("git hooks").
		WithLabel("component", "server").
		Assess("should run git hooks tests", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ffs := []struct {
				Name string
				FF   string
			}{
				{Name: "classic"},
			}

			for _, ff := range ffs {
				func() {
					ctx, cancel := context.WithTimeout(testCtx, 10*time.Minute)
					defer cancel()

					api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
					defer api.Done(t)

					username := username + ff.Name
					userId, err := api.CreateUser(username, userToken)
					if err != nil {
						t.Fatal(err)
					}

					if err := api.UpdateUserFeatureFlag(userId, ff.FF); err != nil {
						t.Fatal(err)
					}
				}()
			}

			for _, ff := range ffs {
				for _, test := range tests {
					test := test
					t.Run(test.ContextURL+"_"+ff.Name, func(t *testing.T) {
						t.Parallel()

						ctx, cancel := context.WithTimeout(context.Background(), time.Duration(5*len(tests)*len(ffs))*time.Minute)
						defer cancel()

						username := username + ff.Name

						api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
						defer api.Done(t)

						wsInfo, stopWs, err := integration.LaunchWorkspaceFromContextURL(t, ctx, test.ContextURL, username, api)
						if err != nil {
							t.Fatal(err)
						}

						t.Cleanup(func() {
							sctx, scancel := context.WithTimeout(context.Background(), 10*time.Minute)
							defer scancel()

							sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
							defer sapi.Done(t)

							if _, err := stopWs(true, sapi); err != nil {
								t.Fatal(err)
							}
						})
						rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(), integration.WithInstanceID(wsInfo.LatestInstance.ID))
						if err != nil {
							t.Fatal(err)
						}
						defer rsa.Close()
						integration.DeferCloser(t, closer)

						var ls agent.ListDirResponse
						err = rsa.Call("WorkspaceAgent.ListDir", &agent.ListDirRequest{
							Dir: test.WorkspaceRoot,
						}, &ls)
						if err != nil {
							t.Fatal(err)
						}
						for _, f := range ls.Files {
							if f == FILE_CREATED_HOOKS {
								t.Fatal("Checkout hooks are executed")
							}
						}
					})
				}
			}
			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}
