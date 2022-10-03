// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

func TestAdditionalRepositories(t *testing.T) {
	f := features.New("additional-repositories").
		WithLabel("component", "ws-manager").
		Assess("can open a workspace using the additionalRepositories property", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			tests := []struct {
				Name       string
				ContextURL string
			}{
				{
					Name:       "workspace with additionalRepositories using a branch",
					ContextURL: "https://github.com/gitpod-io/gitpod-test-repo/tree/aledbf/test-additional-repositories",
				},
				{
					Name:       "workspace with additionalRepositories also using a branch in one of the additionalRepositories",
					ContextURL: "https://github.com/gitpod-io/gitpod-test-repo/tree/aledbf/test-additional-repositories-with-branches",
				},
			}
			ctx, cancel := context.WithTimeout(context.Background(), time.Duration(5*len(tests))*time.Minute)
			defer cancel()

			for _, test := range tests {
				t.Run(test.Name, func(t *testing.T) {
					api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
					t.Cleanup(func() {
						api.Done(t)
					})

					_, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
						req.Type = wsmanapi.WorkspaceType_PREBUILD

						req.Spec.Initializer = &csapi.WorkspaceInitializer{
							Spec: &csapi.WorkspaceInitializer_Git{
								Git: &csapi.GitInitializer{
									RemoteUri: test.ContextURL,
									Config:    &csapi.GitConfig{},
								},
							},
						}
						return nil
					}))
					if err != nil {
						t.Fatalf("cannot launch a workspace: %q", err)
					}

					defer func() {
						sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
						defer scancel()

						sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
						defer sapi.Done(t)

						_, err = stopWs(true, sapi)
						if err != nil {
							t.Errorf("cannot stop workspace: %q", err)
						}
					}()
				})
			}
			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
