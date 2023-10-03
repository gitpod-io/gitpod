// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
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
	"github.com/gitpod-io/gitpod/test/pkg/report"
)

func TestWorkspaceInstrumentation(t *testing.T) {
	userToken, _ := os.LookupEnv("USER_TOKEN")
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)
	tests := []struct {
		Name          string
		ContextURL    string
		WorkspaceRoot string
	}{
		{
			Name:          "example",
			ContextURL:    "https://github.com/gitpod-io/empty",
			WorkspaceRoot: "/workspace/empty",
		},
	}

	f := features.New("instrumentation").
		WithLabel("component", "server").
		Assess("it can instrument a workspace", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			for _, test := range tests {
				test := test
				t.Run(test.ContextURL, func(t *testing.T) {
					report.SetupReport(t, report.FeatureExample, "this is the example test for instrumenting a workspace")

					t.Parallel()

					ctx, cancel := context.WithTimeout(testCtx, time.Duration(5*len(tests))*time.Minute)
					defer cancel()

					api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
					t.Cleanup(func() {
						api.Done(t)
					})

					_, err := api.CreateUser(username, userToken)
					if err != nil {
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

					var ls agent.ListDirResponse
					err = rsa.Call("WorkspaceAgent.ListDir", &agent.ListDirRequest{
						Dir: test.WorkspaceRoot,
					}, &ls)
					if err != nil {
						t.Fatal(err)
					}
					for _, f := range ls.Files {
						t.Log(f)
					}
				})
			}

			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}

func TestLaunchWorkspaceDirectly(t *testing.T) {
	f := features.New("workspace").
		WithLabel("component", "server").
		Assess("it can run workspace tasks", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			t.Parallel()

			ctx, cancel := context.WithTimeout(testCtx, 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			_, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api)
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

			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}
