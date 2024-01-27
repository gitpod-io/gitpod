// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

// TestBackup tests a basic start/modify/restart cycle
func TestBackup(t *testing.T) {
	f := features.New("backup").
		WithLabel("component", "ws-manager").
		Assess("it should start a workspace, create a file and successfully create a backup", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			tests := []struct {
				Name             string
				ContextURL       string
				WorkspaceRoot    string
				CheckoutLocation string
				FF               []wsmanapi.WorkspaceFeatureFlag
			}{
				{
					Name:             "classic",
					ContextURL:       "https://github.com/gitpod-io/empty",
					WorkspaceRoot:    "/workspace/empty",
					CheckoutLocation: "empty",
				},
			}
			for _, test := range tests {
				test := test
				t.Run(test.Name, func(t *testing.T) {
					t.Parallel()

					ctx, cancel := context.WithTimeout(testCtx, time.Duration(10*len(tests))*time.Minute)
					defer cancel()

					api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
					t.Cleanup(func() {
						api.Done(t)
					})

					// TODO: change to use server API to launch the workspace, so we could run the integration test as the user code flow
					//       which is client -> server -> ws-manager rather than client -> ws-manager directly
					ws1, stopWs1, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(func(w *wsmanapi.StartWorkspaceRequest) error {
						w.Spec.FeatureFlags = test.FF
						w.Spec.Initializer = &csapi.WorkspaceInitializer{
							Spec: &csapi.WorkspaceInitializer_Git{
								Git: &csapi.GitInitializer{
									RemoteUri:        test.ContextURL,
									CheckoutLocation: test.CheckoutLocation,
									Config:           &csapi.GitConfig{},
								},
							},
						}
						w.Spec.WorkspaceLocation = test.CheckoutLocation
						return nil
					}))
					if err != nil {
						t.Fatal(err)
					}
					t.Cleanup(func() {
						if err != nil {
							sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
							defer scancel()

							sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
							defer sapi.Done(t)

							_, err = stopWs1(true, sapi)
							if err != nil {
								t.Fatal(err)
							}
						}
					})

					rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(),
						integration.WithInstanceID(ws1.Req.Id),
						integration.WithContainer("workspace"),
						integration.WithWorkspacekitLift(true),
					)
					if err != nil {
						t.Fatal(err)
					}
					integration.DeferCloser(t, closer)

					var resp agent.WriteFileResponse
					err = rsa.Call("WorkspaceAgent.WriteFile", &agent.WriteFileRequest{
						Path:    fmt.Sprintf("%s/foobar.txt", test.WorkspaceRoot),
						Content: []byte("hello world"),
						Mode:    0644,
					}, &resp)
					rsa.Close()
					if err != nil {
						if _, serr := stopWs1(true, api); serr != nil {
							t.Errorf("cannot stop workspace: %q", serr)
						}
						t.Fatal(err)
					}

					_, err = stopWs1(true, api)
					if err != nil {
						t.Fatal(err)
					}

					ws2, stopWs2, err := integration.LaunchWorkspaceDirectly(t, ctx, api,
						integration.WithRequestModifier(func(w *wsmanapi.StartWorkspaceRequest) error {
							w.ServicePrefix = ws1.Req.ServicePrefix
							w.Metadata.MetaId = ws1.Req.Metadata.MetaId
							w.Metadata.Owner = ws1.Req.Metadata.Owner
							w.Spec.FeatureFlags = ws1.Req.Spec.FeatureFlags
							w.Spec.Initializer = ws1.Req.Spec.Initializer
							w.Spec.WorkspaceLocation = ws1.Req.Spec.WorkspaceLocation

							return nil
						}),
					)
					if err != nil {
						t.Fatal(err)
					}
					t.Cleanup(func() {
						sctx, scancel := context.WithTimeout(context.Background(), 10*time.Minute)
						defer scancel()

						sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
						defer sapi.Done(t)

						_, err = stopWs2(true, sapi)
						if err != nil {
							t.Errorf("cannot stop workspace: %q", err)
						}
					})

					rsa, closer, err = integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(),
						integration.WithInstanceID(ws2.Req.Id),
					)
					if err != nil {
						t.Fatal(err)
					}
					integration.DeferCloser(t, closer)

					var ls agent.ListDirResponse
					err = rsa.Call("WorkspaceAgent.ListDir", &agent.ListDirRequest{
						Dir: test.WorkspaceRoot,
					}, &ls)
					if err != nil {
						t.Fatal(err)
					}
					rsa.Close()

					var found bool
					for _, f := range ls.Files {
						if filepath.Base(f) == "foobar.txt" {
							t.Log("found the target file")
							found = true
							break
						}
					}
					if !found {
						t.Fatal("did not find foobar.txt from previous workspace instance")
					}
				})
			}
			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)

}

// TestMissingBackup ensures workspaces fail if they should have a backup but don't have one
func TestMissingBackup(t *testing.T) {
	f := features.New("CreateWorkspace").
		WithLabel("component", "ws-manager").
		Assess("it ensures workspace fail if they should have a backup but don't have one", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			ws, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api)
			if err != nil {
				t.Fatal(err)
			}

			_, err = stopWs(true, api)
			if err != nil {
				t.Fatal(err)
			}

			contentSvc, err := api.ContentService()
			if err != nil {
				t.Fatal(err)
			}

			_, err = contentSvc.DeleteWorkspace(ctx, &csapi.DeleteWorkspaceRequest{
				OwnerId:     ws.Req.Metadata.Owner,
				WorkspaceId: ws.Req.Metadata.MetaId,
			})
			if err != nil {
				t.Fatal(err)
			}

			tests := []struct {
				Name string
				FF   []wsmanapi.WorkspaceFeatureFlag
			}{
				{Name: "classic"},
			}
			for _, test := range tests {
				test := test
				t.Run(test.Name+"_backup_init", func(t *testing.T) {
					t.Parallel()

					ctx, cancel := context.WithTimeout(context.Background(), time.Duration(5*len(tests))*time.Minute)
					defer cancel()

					testws, stopWs2, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(func(w *wsmanapi.StartWorkspaceRequest) error {
						w.ServicePrefix = ws.Req.ServicePrefix
						w.Metadata.MetaId = ws.Req.Metadata.MetaId
						w.Metadata.Owner = ws.Req.Metadata.Owner
						w.Spec.Initializer = &csapi.WorkspaceInitializer{
							Spec: &csapi.WorkspaceInitializer_Backup{
								Backup: &csapi.FromBackupInitializer{},
							},
						}
						w.Spec.FeatureFlags = test.FF
						return nil
					}), integration.WithWaitWorkspaceForOpts(integration.WorkspaceCanFail, integration.WaitForStopped))
					if err != nil {
						t.Fatal(err)
					}

					t.Cleanup(func() {
						sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
						defer scancel()

						sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
						defer sapi.Done(t)

						_, err := stopWs2(true, sapi)
						if err != nil {
							t.Fatal(err)
						}
					})

					if testws.LastStatus == nil {
						t.Fatal("did not receive a last status")
						return
					}
					if testws.LastStatus.Conditions.Failed == "" {
						t.Errorf("restarted workspace did not fail despite missing backup, %v", testws)
					}

				})
			}
			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}
