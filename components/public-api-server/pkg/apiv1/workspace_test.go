// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/proto"
	"testing"
)

func TestWorkspaceService_GetWorkspace(t *testing.T) {
	srv := baseserver.NewForTests(t)
	v1.RegisterWorkspacesServiceServer(srv.GRPC(), NewWorkspaceService())
	baseserver.StartServerForTests(t, srv)

	conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)

	client := v1.NewWorkspacesServiceClient(conn)

	ctx := metadata.AppendToOutgoingContext(context.Background(), "authorization", "some-token")

	workspaceID := "some-workspace-id"
	resp, err := client.GetWorkspace(ctx, &v1.GetWorkspaceRequest{
		WorkspaceId: workspaceID,
	})
	require.NoError(t, err)
	require.True(t, proto.Equal(&v1.GetWorkspaceResponse{
		Result: &v1.Workspace{
			WorkspaceId: workspaceID,
			OwnerId:     "mock_owner",
			ProjectId:   "mock_project_id",
			Context: &v1.WorkspaceContext{
				ContextUrl: "https://github.com/gitpod-io/gitpod",
				Details:    nil,
			},
			Description: "This is a mock response",
		},
	}, resp))
}
