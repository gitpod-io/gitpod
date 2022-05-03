// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func NewWorkspaceService(serverConnPool proxy.ServerConnectionPool) *WorkspaceService {
	return &WorkspaceService{
		connectionPool:                       serverConnPool,
		UnimplementedWorkspacesServiceServer: &v1.UnimplementedWorkspacesServiceServer{},
	}
}

type WorkspaceService struct {
	connectionPool proxy.ServerConnectionPool

	*v1.UnimplementedWorkspacesServiceServer
}

func (w *WorkspaceService) GetWorkspace(ctx context.Context, r *v1.GetWorkspaceRequest) (*v1.GetWorkspaceResponse, error) {
	token, err := bearerTokenFromContext(ctx)
	if err != nil {
		return nil, err
	}

	server, err := w.connectionPool.Get(ctx, token)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to establish connection to downstream services")
	}

	// TODO(milan): Use resulting workspace and transform it to public API response
	_, err = server.GetWorkspace(ctx, r.GetWorkspaceId())
	if err != nil {
		return nil, status.Error(codes.NotFound, "failed to get workspace")
	}

	return &v1.GetWorkspaceResponse{
		Result: &v1.Workspace{
			WorkspaceId: r.GetWorkspaceId(),
			OwnerId:     "mock_owner",
			ProjectId:   "mock_project_id",
			Context: &v1.WorkspaceContext{
				ContextUrl: "https://github.com/gitpod-io/gitpod",
				Details:    nil,
			},
			Description: "This is a mock response",
		},
	}, nil
}

func bearerTokenFromContext(ctx context.Context) (string, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return "", status.Error(codes.Unauthenticated, "no credentials provided")
	}

	values := md.Get("authorization")
	if len(values) == 0 {
		return "", status.Error(codes.Unauthenticated, "no authorization header specified")
	}
	if len(values) > 1 {
		return "", status.Error(codes.Unauthenticated, "more than one authorization header specified, exactly one is required")
	}

	token := values[0]
	return token, nil
}
