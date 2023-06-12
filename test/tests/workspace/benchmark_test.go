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
)

// 91s initially
// 41s, 65s, 39s, 27s, 26s
func TestBenchmark(t *testing.T) {
	userToken, _ := os.LookupEnv("USER_TOKEN")
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)

	f := features.New("Benchmark").
		WithLabel("component", "workspace").
		Assess("measure test time", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			t.Logf("%v start assess", time.Now())
			ctx, cancel := context.WithTimeout(context.Background(), time.Duration(5*time.Minute))
			defer cancel()

			// 0s
			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})
			t.Logf("%v started asses", time.Now())

			t.Run("test-run", func(t *testing.T) {
				t.Parallel()
				// 0s
				t.Logf("%v start test-run", time.Now())

				// Took 11s -> 5s
				_, err := api.CreateUser(username, userToken)
				if err != nil {
					t.Fatal(err)
				}
				t.Logf("%v created user", time.Now())

				// Took ~50s -> 45s
				nfo, stopWs, err := integration.LaunchWorkspaceFromContextURL(t, ctx, "github.com/gitpod-io/empty", username, api)
				if err != nil {
					t.Fatal(err)
				}
				t.Logf("%v launched workspace", time.Now())
				t.Cleanup(func() {
					// 6s for cleanup
					t.Logf("%v starting clenaup", time.Now())
					sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
					defer scancel()

					sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
					defer sapi.Done(t)

					_, err := stopWs(false, sapi)
					if err != nil {
						t.Fatal(err)
					}
					t.Logf("%v cleanup done", time.Now())
				})

				// Took 29s -> 11s
				rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(), integration.WithInstanceID(nfo.LatestInstance.ID))
				if err != nil {
					t.Fatal(err)
				}
				defer rsa.Close()
				integration.DeferCloser(t, closer)

				// <1s
				t.Logf("%v starting exec", time.Now())
				var res agent.ExecResponse
				err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
					Dir:     "/workspace/empty",
					Command: "ls",
				}, &res)
				if err != nil {
					t.Fatal(err)
				}

				t.Logf("ls: %s (%d)", res.Stdout, res.ExitCode)

				t.Logf("%v test finished", time.Now())
			})
			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
