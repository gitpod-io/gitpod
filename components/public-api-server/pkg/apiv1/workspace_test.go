// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestWorkspaceService_GetWorkspace(t *testing.T) {
	svc := NewWorkspaceService()

	workspaceID := "some-workspace-id"
	resp, err := svc.GetWorkspace(context.Background(), &v1.GetWorkspaceRequest{
		WorkspaceId: workspaceID,
	})
	require.NoError(t, err)
	require.Equal(t, &v1.GetWorkspaceResponse{
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
	}, resp)
}
