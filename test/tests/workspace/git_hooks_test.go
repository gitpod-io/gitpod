// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"os"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

type GitHooksTest struct {
	Name          string
	ContextURL    string
	WorkspaceRoot string
}

func GithuHooksTest(t *testing.T) {
	userToken, _ := os.LookupEnv("USER_TOKEN")
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)

	parallelLimiter := make(chan struct{}, 2)

	tests := []GitHooksTest{
		{
			Name:          "husky",
			ContextURL:    "https://github.com/gitpod-io/gitpod-test-repo/tree/husky",
			WorkspaceRoot: "/workspace/template-golang-cli",
		},
	}

	f := features.New("git hooks").
		WithLabel("component", "server").
		Assess("should run git hooks tests", func(ctx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ffs := []struct {
				Name string
				FF   string
			}{
				{Name: "classic"},
				{Name: "pvc", FF: "persistent_volume_claim"},
			}

			for _, ff := range ffs {
				func() {
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
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
					t.Run(test.ContextURL+"_"+ff.Name, func(t *testing.T) {
						t.Parallel()

						t.Logf("Waiting %s", test.ContextURL+"_"+ff.Name)

						parallelLimiter <- struct{}{}
						defer func() {
							<-parallelLimiter
						}()

						t.Logf("Running %s", test.ContextURL+"_"+ff.Name)

						username := username + ff.Name

						ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
						defer cancel()

						api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
						defer api.Done(t)

						_, stopWs, err := integration.LaunchWorkspaceFromContextURL(t, ctx, test.ContextURL, username, api)
						if err != nil {
							t.Fatal(err)
						}

						defer func() {
							sctx, scancel := context.WithTimeout(context.Background(), 10*time.Minute)
							defer scancel()

							sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
							defer sapi.Done(t)

							if _, err := stopWs(true, sapi); err != nil {
								t.Fatal(err)
							}
						}()
					})
				}
			}
			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
