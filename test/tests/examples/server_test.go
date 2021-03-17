// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package examples

import (
	"context"
	"testing"
	"time"

	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

func TestServerAccess(t *testing.T) {
	it, ctx := integration.NewTest(t, 5*time.Second)
	defer it.Done()

	server := it.API().GitpodServer()
	res, err := server.GetLoggedInUser(ctx)
	if err != nil {
		t.Fatal(err)
	}
	t.Log(res.Name)
}

func TestStartWorkspace(t *testing.T) {
	it, ctx := integration.NewTest(t, 5*time.Minute)
	defer it.Done()

	server := it.API().GitpodServer()
	resp, err := server.CreateWorkspace(ctx, &protocol.CreateWorkspaceOptions{
		ContextURL: "github.com/gitpod-io/gitpod",
		Mode:       "force-new",
	})
	if err != nil {
		t.Fatalf("cannot start workspace: %q", err)
	}
	defer func() {
		cctx, ccancel := context.WithTimeout(context.Background(), 10*time.Second)
		err := server.StopWorkspace(cctx, resp.CreatedWorkspaceID)
		ccancel()
		if err != nil {
			t.Errorf("cannot stop workspace: %q", err)
		}
	}()
	t.Logf("created workspace: workspaceID=%s url=%s", resp.CreatedWorkspaceID, resp.WorkspaceURL)

	nfo, err := server.GetWorkspace(ctx, resp.CreatedWorkspaceID)
	if err != nil {
		t.Fatalf("cannot get workspace: %q", err)
	}
	if nfo.LatestInstance == nil {
		t.Fatal("CreateWorkspace did not start the workspace")
	}

	it.WaitForWorkspace(ctx, nfo.LatestInstance.ID)

	t.Logf("workspace is running: instanceID=%s", nfo.LatestInstance.ID)
}
