// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	content_service_api "github.com/gitpod-io/gitpod/content-service/api"
	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

// TestBackup tests a basic start/modify/restart cycle
func TestBackup(t *testing.T) {
	f := features.New("backup").
		Assess("it should start a workspace, create a file and successfully create a backup", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			wsm, err := api.WorkspaceManager()
			if err != nil {
				t.Fatal(err)
			}

			ws, err := integration.LaunchWorkspaceDirectly(ctx, api)
			if err != nil {
				t.Fatal(err)
			}

			rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), cfg.Client(),
				integration.WithInstanceID(ws.Req.Id),
				integration.WithContainer("workspace"),
				integration.WithWorkspacekitLift(true),
			)
			if err != nil {
				t.Fatal(err)
			}
			integration.DeferCloser(t, closer)

			var resp agent.WriteFileResponse
			err = rsa.Call("WorkspaceAgent.WriteFile", &agent.WriteFileRequest{
				Path:    "/workspace/foobar.txt",
				Content: []byte("hello world"),
				Mode:    0644,
			}, &resp)
			if err != nil {
				_, _ = wsm.StopWorkspace(ctx, &wsapi.StopWorkspaceRequest{Id: ws.Req.Id})
				t.Fatal(err)
			}
			rsa.Close()

			_, err = wsm.StopWorkspace(ctx, &wsapi.StopWorkspaceRequest{
				Id: ws.Req.Id,
			})
			if err != nil {
				t.Fatal(err)
			}

			_, err = integration.WaitForWorkspaceStop(ctx, api, ws.Req.Id)
			if err != nil {
				t.Fatal(err)
			}

			ws, err = integration.LaunchWorkspaceDirectly(ctx, api,
				integration.WithRequestModifier(func(w *wsapi.StartWorkspaceRequest) error {
					w.ServicePrefix = ws.Req.ServicePrefix
					w.Metadata.MetaId = ws.Req.Metadata.MetaId
					w.Metadata.Owner = ws.Req.Metadata.Owner
					return nil
				}),
			)
			if err != nil {
				t.Fatal(err)
			}

			rsa, closer, err = integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), cfg.Client(),
				integration.WithInstanceID(ws.Req.Id),
			)
			if err != nil {
				t.Fatal(err)
			}
			integration.DeferCloser(t, closer)

			defer func() {
				t.Log("Cleaning up on TestBackup exit")
				sctx, scancel := context.WithTimeout(ctx, 5*time.Second)
				defer scancel()
				_, _ = wsm.StopWorkspace(sctx, &wsapi.StopWorkspaceRequest{
					Id: ws.Req.Id,
				})
			}()

			var ls agent.ListDirResponse
			err = rsa.Call("WorkspaceAgent.ListDir", &agent.ListDirRequest{
				Dir: "/workspace",
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
		WithLabel("component", "server").
		Assess("it can run workspace tasks", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			ws, err := integration.LaunchWorkspaceDirectly(ctx, api)
			if err != nil {
				t.Fatal(err)
			}

			wsm, err := api.WorkspaceManager()
			if err != nil {
				t.Fatal(err)
			}

			_, err = wsm.StopWorkspace(ctx, &wsapi.StopWorkspaceRequest{Id: ws.Req.Id})
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

			_, err = contentSvc.DeleteWorkspace(ctx, &content_service_api.DeleteWorkspaceRequest{
				OwnerId:     ws.Req.Metadata.Owner,
				WorkspaceId: ws.Req.Metadata.MetaId,
			})
			if err != nil {
				t.Fatal(err)
			}

			tests := []struct {
				Name string
				FF   []wsapi.WorkspaceFeatureFlag
			}{
				{Name: "classic"},
				{Name: "fwb", FF: []wsapi.WorkspaceFeatureFlag{wsapi.WorkspaceFeatureFlag_FULL_WORKSPACE_BACKUP}},
			}
			for _, test := range tests {
				t.Run(test.Name+"_backup_init", func(t *testing.T) {
					testws, err := integration.LaunchWorkspaceDirectly(ctx, api, integration.WithRequestModifier(func(w *wsapi.StartWorkspaceRequest) error {
						w.ServicePrefix = ws.Req.ServicePrefix
						w.Metadata.MetaId = ws.Req.Metadata.MetaId
						w.Metadata.Owner = ws.Req.Metadata.Owner
						w.Spec.Initializer = &content_service_api.WorkspaceInitializer{
							Spec: &content_service_api.WorkspaceInitializer_Backup{
								Backup: &content_service_api.FromBackupInitializer{},
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
						t.Error("restarted workspace did not fail despite missing backup")
					}
				})
			}
			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
