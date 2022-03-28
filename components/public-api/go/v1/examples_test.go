// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package v1_test

import (
	context "context"
	"fmt"

	v1 "github.com/gitpod-io/gitpod/public-api/v1"
)

var (
	workspaces v1.WorkspacesServiceClient
	prebuilds  v1.PrebuildsServiceClient
	ctx        context.Context
)

func ExampleCreateAndStartWorkspace_NotPrebuildAware() {
	// This creates and starts a workspace with the default behaviour. If
	// there is a prebuild availble (i.e. DONE), the workspace will be created
	// from that prebuild. If there's currently a prebuild running for this
	// context URL, the prebuild is ignored.
	workspaces.CreateAndStartWorkspace(ctx, &v1.CreateAndStartWorkspaceRequest{
		IdempotencyToken: uuidv4(),
		Source: &v1.CreateAndStartWorkspaceRequest_ContextUrl{
			ContextUrl: "https://github.com/gitpod-io/gitpod",
		},
	})
}

func ExampleCreateAndStartWorkspace_WaitForPrebuild() {
	contextURL := "https://github.com/gitpod-io/gitpod"

	// we check if there's a prebuild running. If so, we'll start
	// listening for status updates and create/start the workspace
	// once the prebuild is done.
	pb, _ := prebuilds.GetRunningPrebuild(ctx, &v1.GetRunningPrebuildRequest{
		ContextUrl: contextURL,
	})

	if pb != nil && pb.Prebuild.Status.Phase != v1.PrebuildStatus_PHASE_DONE {
		sts, _ := prebuilds.ListenToPrebuildStatus(ctx, &v1.ListenToPrebuildStatusRequest{
			PrebuildId: pb.Prebuild.PrebuildId,
		})
		for {
			resp, _ := sts.Recv()
			if resp.Status.Phase == v1.PrebuildStatus_PHASE_DONE {
				break
			}
		}
	}

	// at this point the prebuild is done and we can start the workspace
	// referencing the prebuild.
	workspaces.CreateAndStartWorkspace(ctx, &v1.CreateAndStartWorkspaceRequest{
		IdempotencyToken: uuidv4(),
		Source: &v1.CreateAndStartWorkspaceRequest_PrebuildId{
			PrebuildId: pb.Prebuild.PrebuildId,
		},
	})
}

func ExampleStartWorkspace_NoImageBuildLogs() {
	workspaces.StartWorkspace(ctx, &v1.StartWorkspaceRequest{
		IdempotencyToken: uuidv4(),
		WorkspaceId:      "some-workspace-id",
	})
}

func ExampleStartWorkspace_WithImageBuildLogs() {
	wsi, _ := workspaces.StartWorkspace(ctx, &v1.StartWorkspaceRequest{
		IdempotencyToken: uuidv4(),
		WorkspaceId:      "some-workspace-id",
	})
	updates, _ := workspaces.ListenToWorkspaceInstance(ctx, &v1.ListenToWorkspaceInstanceRequest{
		InstanceId: wsi.InstanceId,
	})

	listenToImageBuildLogs := func(ctx context.Context, instanceID string) {
		logs, _ := workspaces.ListenToImageBuildLogs(ctx, &v1.ListenToImageBuildLogsRequest{
			InstanceId: instanceID,
		})
		for {
			msg, _ := logs.Recv()
			fmt.Println(msg.Line)
		}
	}

	for {
		status, _ := updates.Recv()
		switch status.InstanceStatus.Phase {
		case v1.WorkspaceInstancePhase_WORKSPACE_INSTANCE_PHASE_IMAGEBUILD:
			go listenToImageBuildLogs(ctx, wsi.InstanceId)
		case v1.WorkspaceInstancePhase_WORKSPACE_INSTANCE_PHASE_RUNNING,
			v1.WorkspaceInstancePhase_WORKSPACE_INSTANCE_PHASE_STOPPING,
			v1.WorkspaceInstancePhase_WORKSPACE_INSTANCE_PHASE_STOPPED:
			return
		}
	}
}

func uuidv4() string {
	return "dbf017dd-d40e-4e7c-9af8-0dd565974217"
}
