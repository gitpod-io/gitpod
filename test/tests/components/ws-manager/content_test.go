// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"path/filepath"
	"reflect"
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
		Assess("it should start a workspace, create a file and successfully create a backup", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			tests := []struct {
				Name string
				FF   []wsmanapi.WorkspaceFeatureFlag
			}{
				{Name: "classic"},
				{Name: "pvc", FF: []wsmanapi.WorkspaceFeatureFlag{wsmanapi.WorkspaceFeatureFlag_PERSISTENT_VOLUME_CLAIM}},
			}
			for _, test := range tests {
				t.Run(test.Name+"_backup", func(t *testing.T) {
					ws1, stopWs1, err := integration.LaunchWorkspaceDirectly(ctx, api, integration.WithRequestModifier(func(w *wsmanapi.StartWorkspaceRequest) error {
						w.Spec.FeatureFlags = test.FF
						w.Spec.Initializer = &csapi.WorkspaceInitializer{
							Spec: &csapi.WorkspaceInitializer_Git{
								Git: &csapi.GitInitializer{
									RemoteUri:        "https://github.com/gitpod-io/gitpod.git",
									TargetMode:       csapi.CloneTargetMode_REMOTE_BRANCH,
									CloneTaget:       "main",
									CheckoutLocation: "gitpod",
									Config:           &csapi.GitConfig{},
								},
							},
						}
						w.Spec.WorkspaceLocation = "gitpod"
						return nil
					}))
					if err != nil {
						t.Fatal(err)
					}

					rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(),
						integration.WithInstanceID(ws1.Req.Id),
						integration.WithContainer("workspace"),
						integration.WithWorkspacekitLift(true),
					)
					if err != nil {
						if err := stopWs1(true); err != nil {
							t.Errorf("cannot stop workspace: %q", err)
						}
						t.Fatal(err)
					}
					integration.DeferCloser(t, closer)

					var resp agent.WriteFileResponse
					err = rsa.Call("WorkspaceAgent.WriteFile", &agent.WriteFileRequest{
						Path:    "/workspace/gitpod/foobar.txt",
						Content: []byte("hello world"),
						Mode:    0644,
					}, &resp)
					rsa.Close()
					if err != nil {
						if err = stopWs1(true); err != nil {
							t.Errorf("cannot stop workspace: %q", err)
						}
						t.Fatal(err)
					}

					err = stopWs1(true)
					if err != nil {
						t.Fatal(err)
					}

					ws2, stopWs2, err := integration.LaunchWorkspaceDirectly(ctx, api,
						integration.WithRequestModifier(func(w *wsmanapi.StartWorkspaceRequest) error {
							w.ServicePrefix = ws1.Req.ServicePrefix
							w.Metadata.MetaId = ws1.Req.Metadata.MetaId
							w.Metadata.Owner = ws1.Req.Metadata.Owner
							w.Spec.FeatureFlags = ws1.Req.Spec.FeatureFlags
							w.Spec.Initializer = ws1.Req.Spec.Initializer
							w.Spec.WorkspaceLocation = ws1.Req.Spec.WorkspaceLocation

							if !reflect.DeepEqual(w.Spec.FeatureFlags, []wsmanapi.WorkspaceFeatureFlag{wsmanapi.WorkspaceFeatureFlag_PERSISTENT_VOLUME_CLAIM}) {
								return nil
							}

							// PVC: find VolumeSnapshot by workspace ID
							volumeSnapshot, volumeSnapshotContent, err := integration.FindVolumeSnapshot(ctx, ws1.Req.Id, cfg.Namespace(), cfg.Client())
							if err != nil {
								return err
							}
							if volumeSnapshot != "" && volumeSnapshotContent != "" {
								w.Spec.VolumeSnapshot = &wsmanapi.VolumeSnapshotInfo{VolumeSnapshotName: volumeSnapshot, VolumeSnapshotHandle: volumeSnapshotContent}
							}
							return nil
						}),
					)
					if err != nil {
						t.Fatal(err)
					}
					t.Cleanup(func() {
						err = stopWs2(true)
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
						Dir: "/workspace/gitpod",
					}, &ls)
					if err != nil {
						t.Fatal(err)
					}

					rsa.Close()

					var found bool
					for _, f := range ls.Files {
						if filepath.Base(f) == "foobar.txt" {
							found = true
							break
						}
					}
					if !found {
						t.Fatal("did not find foobar.txt from previous workspace instance")
					}
				})
			}
			return ctx
		}).
		Feature()

	testEnv.Test(t, f)

}

// TestExistingWorkspaceEnablePVC tests enable PVC feature flag on the existing workspace
func TestExistingWorkspaceEnablePVC(t *testing.T) {
	f := features.New("backup").
		WithLabel("component", "ws-manager").
		Assess("it should enable PVC feature flag to the existing workspace without data loss", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			// Create a new workspace without the PVC feature flag
			ws1, stopWs1, err := integration.LaunchWorkspaceDirectly(ctx, api, integration.WithRequestModifier(func(w *wsmanapi.StartWorkspaceRequest) error {
				w.Spec.Initializer = &csapi.WorkspaceInitializer{
					Spec: &csapi.WorkspaceInitializer_Git{
						Git: &csapi.GitInitializer{
							RemoteUri:        "https://github.com/gitpod-io/gitpod.git",
							TargetMode:       csapi.CloneTargetMode_REMOTE_BRANCH,
							CloneTaget:       "main",
							CheckoutLocation: "gitpod",
							Config:           &csapi.GitConfig{},
						},
					},
				}
				w.Spec.WorkspaceLocation = "gitpod"
				return nil
			}))
			if err != nil {
				t.Fatal(err)
			}

			rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(),
				integration.WithInstanceID(ws1.Req.Id),
				integration.WithContainer("workspace"),
				integration.WithWorkspacekitLift(true),
			)
			if err != nil {
				if err := stopWs1(true); err != nil {
					t.Errorf("cannot stop workspace: %q", err)
				}
				t.Fatal(err)
			}
			integration.DeferCloser(t, closer)

			var resp agent.WriteFileResponse
			err = rsa.Call("WorkspaceAgent.WriteFile", &agent.WriteFileRequest{
				Path:    "/workspace/gitpod/foobar.txt",
				Content: []byte("hello world"),
				Mode:    0644,
			}, &resp)
			rsa.Close()
			if err != nil {
				if err = stopWs1(true); err != nil {
					t.Errorf("cannot stop workspace: %q", err)
				}
				t.Fatal(err)
			}

			err = stopWs1(true)
			if err != nil {
				t.Fatal(err)
			}

			// Relaunch the workspace and enable the PVC feature flag
			ws2, stopWs2, err := integration.LaunchWorkspaceDirectly(ctx, api,
				integration.WithRequestModifier(func(w *wsmanapi.StartWorkspaceRequest) error {
					w.ServicePrefix = ws1.Req.ServicePrefix
					w.Metadata.MetaId = ws1.Req.Metadata.MetaId
					w.Metadata.Owner = ws1.Req.Metadata.Owner
					w.Spec.FeatureFlags = []wsmanapi.WorkspaceFeatureFlag{wsmanapi.WorkspaceFeatureFlag_PERSISTENT_VOLUME_CLAIM}
					w.Spec.Initializer = ws1.Req.Spec.Initializer
					w.Spec.WorkspaceLocation = ws1.Req.Spec.WorkspaceLocation
					return nil
				}),
			)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				err = stopWs2(true)
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
				Dir: "/workspace/gitpod",
			}, &ls)
			if err != nil {
				t.Fatal(err)
			}

			rsa.Close()

			var found bool
			for _, f := range ls.Files {
				if filepath.Base(f) == "foobar.txt" {
					found = true
					break
				}
			}
			if !found {
				t.Fatal("did not find foobar.txt from previous workspace instance")
			}
			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}

// TestMissingBackup ensures workspaces fail if they should have a backup but don't have one
func TestMissingBackup(t *testing.T) {
	f := features.New("CreateWorkspace").
		WithLabel("component", "ws-manager").
		Assess("it ensures workspace fail if they should have a backup but don't have one", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			ws, stopWs, err := integration.LaunchWorkspaceDirectly(ctx, api)
			if err != nil {
				t.Fatal(err)
			}

			wsm, err := api.WorkspaceManager()
			if err != nil {
				err = stopWs(true)
				if err != nil {
					t.Errorf("cannot stop workspace: %q", err)
				}
				t.Fatal(err)
			}

			_, err = wsm.StopWorkspace(ctx, &wsmanapi.StopWorkspaceRequest{Id: ws.Req.Id})
			if err != nil {
				t.Fatal(err)
			}

			_, err = integration.WaitForWorkspaceStop(ctx, api, ws.Req.Id)
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
				{Name: "fwb", FF: []wsmanapi.WorkspaceFeatureFlag{wsmanapi.WorkspaceFeatureFlag_FULL_WORKSPACE_BACKUP}},
				{Name: "pvc", FF: []wsmanapi.WorkspaceFeatureFlag{wsmanapi.WorkspaceFeatureFlag_PERSISTENT_VOLUME_CLAIM}},
			}
			for _, test := range tests {
				t.Run(test.Name+"_backup_init", func(t *testing.T) {
					testws, stopWs, err := integration.LaunchWorkspaceDirectly(ctx, api, integration.WithRequestModifier(func(w *wsmanapi.StartWorkspaceRequest) error {
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
					}), integration.WithWaitWorkspaceForOpts(integration.WorkspaceCanFail))
					if err != nil {
						t.Fatal(err)
					}

					if testws.LastStatus == nil {
						t.Fatal("did not receive a last status")
						return
					}
					if testws.LastStatus.Conditions.Failed == "" {
						err = stopWs(true)
						if err != nil {
							t.Errorf("cannot stop workspace: %q", err)
						}
						t.Errorf("restarted workspace did not fail despite missing backup, %v", testws)
					}
				})
			}
			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
