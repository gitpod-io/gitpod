// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	agent "github.com/gitpod-io/gitpod/test/tests/workspace/workspace_agent/api"
	wsapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

// TestBackup tests a basic start/modify/restart cycle
func TestBackup(t *testing.T) {
	it, ctx := integration.NewTest(t, 5*time.Minute)
	defer it.Done()

	ws := integration.LaunchWorkspaceDirectly(it)
	rsa, err := it.Instrument(integration.ComponentWorkspace, "workspace", integration.WithInstanceID(ws.Req.Id), integration.WithContainer("workspace"), integration.WithWorkspacekitLift(true))
	if err != nil {
		t.Fatal(err)
		return
	}

	var resp agent.WriteFileResponse
	err = rsa.Call("WorkspaceAgent.WriteFile", &agent.WriteFileRequest{
		Path:    "/workspace/foobar.txt",
		Content: []byte("hello world"),
		Mode:    0644,
	}, &resp)
	if err != nil {
		_, _ = it.API().WorkspaceManager().StopWorkspace(ctx, &wsapi.StopWorkspaceRequest{Id: ws.Req.Id})
		t.Fatal(err)
		return
	}
	rsa.Close()

	sctx, scancel := context.WithTimeout(ctx, 5*time.Second)
	defer scancel()
	_, err = it.API().WorkspaceManager().StopWorkspace(sctx, &wsapi.StopWorkspaceRequest{
		Id: ws.Req.Id,
	})
	if err != nil {
		t.Fatal(err)
		return
	}

	it.WaitForWorkspaceStop(ws.Req.Id)

	ws = integration.LaunchWorkspaceDirectly(it, integration.WithRequestModifier(func(w *wsapi.StartWorkspaceRequest) error {
		w.ServicePrefix = ws.Req.ServicePrefix
		w.Metadata.MetaId = ws.Req.Metadata.MetaId
		w.Metadata.Owner = ws.Req.Metadata.Owner
		return nil
	}))
	rsa, err = it.Instrument(integration.ComponentWorkspace, "workspace", integration.WithInstanceID(ws.Req.Id))
	if err != nil {
		t.Fatal(err)
		return
	}

	defer func() {
		t.Log("Cleaning up on TestBackup exit")
		sctx, scancel := context.WithTimeout(ctx, 5*time.Second)
		defer scancel()
		_, err = it.API().WorkspaceManager().StopWorkspace(sctx, &wsapi.StopWorkspaceRequest{
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
}

// TestMissingBackup ensures workspaces fail if they should have a backup but don't have one
func TestMissingBackup(t *testing.T) {
	it, ctx := integration.NewTest(t, 5*time.Minute)
	defer it.Done()

	ws := integration.LaunchWorkspaceDirectly(it)

	sctx, scancel := context.WithTimeout(ctx, 5*time.Second)
	defer scancel()
	_, err := it.API().WorkspaceManager().StopWorkspace(sctx, &wsapi.StopWorkspaceRequest{Id: ws.Req.Id})
	if err != nil {
		t.Fatal(err)
		return
	}
	it.WaitForWorkspaceStop(ws.Req.Id)

	_, err = it.API().ContentService().DeleteWorkspace(ctx, &api.DeleteWorkspaceRequest{
		OwnerId:     ws.Req.Metadata.Owner,
		WorkspaceId: ws.Req.Metadata.MetaId,
	})
	if err != nil {
		t.Fatal(err)
		return
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
			it := it.Child(t)
			testws := integration.LaunchWorkspaceDirectly(it, integration.WithRequestModifier(func(w *wsapi.StartWorkspaceRequest) error {
				w.ServicePrefix = ws.Req.ServicePrefix
				w.Metadata.MetaId = ws.Req.Metadata.MetaId
				w.Metadata.Owner = ws.Req.Metadata.Owner
				w.Spec.Initializer = &api.WorkspaceInitializer{Spec: &api.WorkspaceInitializer_Backup{Backup: &api.FromBackupInitializer{}}}
				w.Spec.FeatureFlags = test.FF
				return nil
			}), integration.WithWaitWorkspaceForOpts(integration.WorkspaceCanFail))
			if testws.LastStatus == nil {
				t.Fatal("did not receive a last status")
				return
			}
			if testws.LastStatus.Conditions.Failed == "" {
				t.Error("restarted workspace did not fail despite missing backup")
			}
		})
	}
}
