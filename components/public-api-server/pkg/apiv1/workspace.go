// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"

	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
	"github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus/ctxlogrus"
	"github.com/relvacode/iso8601"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
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
	logger := ctxlogrus.Extract(ctx)
	token, err := bearerTokenFromContext(ctx)
	if err != nil {
		return nil, err
	}

	server, err := w.connectionPool.Get(ctx, token)
	if err != nil {
		logger.WithError(err).Error("Failed to get connection to server.")
		return nil, status.Error(codes.Internal, "failed to establish connection to downstream services")
	}

	workspace, err := server.GetWorkspace(ctx, r.GetWorkspaceId())
	if err != nil {
		logger.WithError(err).Error("Failed to get workspace.")
		converted := proxy.ConvertError(err)
		switch status.Code(converted) {
		case codes.PermissionDenied:
			return nil, status.Error(codes.PermissionDenied, "insufficient permission to access workspace")
		case codes.NotFound:
			return nil, status.Error(codes.NotFound, "workspace does not exist")
		default:
			return nil, status.Error(codes.Internal, "unable to retrieve workspace")
		}
	}

	return &v1.GetWorkspaceResponse{
		Result: &v1.Workspace{
			WorkspaceId: workspace.Workspace.ID,
			OwnerId:     workspace.Workspace.OwnerID,
			ProjectId:   "",
			Context: &v1.WorkspaceContext{
				ContextUrl: workspace.Workspace.ContextURL,
				Details: &v1.WorkspaceContext_Git_{Git: &v1.WorkspaceContext_Git{
					NormalizedContextUrl: workspace.Workspace.ContextURL,
					Commit:               "",
				}},
			},
			Description: workspace.Workspace.Description,
		},
	}, nil
}

func (w *WorkspaceService) GetOwnerToken(ctx context.Context, r *v1.GetOwnerTokenRequest) (*v1.GetOwnerTokenResponse, error) {
	logger := ctxlogrus.Extract(ctx)
	token, err := bearerTokenFromContext(ctx)
	if err != nil {
		return nil, err
	}

	server, err := w.connectionPool.Get(ctx, token)
	if err != nil {
		logger.WithError(err).Error("Failed to get connection to server.")
		return nil, status.Error(codes.Internal, "failed to establish connection to downstream services")
	}

	ownerToken, err := server.GetOwnerToken(ctx, r.GetWorkspaceId())

	if err != nil {
		logger.WithError(err).Error("Failed to get owner token.")
		converted := proxy.ConvertError(err)
		switch status.Code(converted) {
		case codes.PermissionDenied:
			return nil, status.Error(codes.PermissionDenied, "insufficient permission to retrieve ownertoken")
		case codes.NotFound:
			return nil, status.Error(codes.NotFound, "workspace does not exist")
		default:
			return nil, status.Error(codes.Internal, "unable to retrieve owner token")
		}
	}

	return &v1.GetOwnerTokenResponse{Token: ownerToken}, nil
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

func (w *WorkspaceService) ListWorkspaces(ctx context.Context, req *v1.ListWorkspacesRequest) (*v1.ListWorkspacesResponse, error) {
	logger := ctxlogrus.Extract(ctx)
	token, err := bearerTokenFromContext(ctx)
	if err != nil {
		return nil, err
	}

	server, err := w.connectionPool.Get(ctx, token)
	if err != nil {
		logger.WithError(err).Error("Failed to get connection to server.")
		return nil, status.Error(codes.Internal, "failed to establish connection to downstream services")
	}

	limit, err := getLimitFromPagination(req.Pagination)
	if err != nil {
		// getLimitFromPagination returns gRPC errors
		return nil, err
	}
	serverResp, err := server.GetWorkspaces(ctx, &protocol.GetWorkspacesOptions{
		Limit: float64(limit),
	})
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	res := make([]*v1.ListWorkspacesResponse_WorkspaceAndInstance, 0, len(serverResp))
	for _, ws := range serverResp {
		workspaceAndInstance, err := convertWorkspaceInfo(ws)
		if err != nil {
			// convertWorkspaceInfo returns gRPC errors
			return nil, err
		}

		res = append(res, workspaceAndInstance)
	}

	return &v1.ListWorkspacesResponse{
		Result: res,
	}, nil
}

func getLimitFromPagination(pagination *v1.Pagination) (int, error) {
	const (
		defaultLimit = 20
		maxLimit     = 100
	)

	if pagination == nil {
		return defaultLimit, nil
	}
	if pagination.PageSize == 0 {
		return defaultLimit, nil
	}
	if pagination.PageSize < 0 || maxLimit < pagination.PageSize {
		return 0, grpc.Errorf(codes.InvalidArgument, "invalid pagination page size (must be 0 < x < %d)", maxLimit)
	}

	return int(pagination.PageSize), nil
}

// convertWorkspaceInfo convers a "protocol workspace" to a "public API workspace". Returns gRPC errors if things go wrong.
func convertWorkspaceInfo(input *protocol.WorkspaceInfo) (*v1.ListWorkspacesResponse_WorkspaceAndInstance, error) {
	var instance *v1.WorkspaceInstance
	if wsi := input.LatestInstance; wsi != nil {
		creationTime, err := parseGitpodTimestamp(wsi.CreationTime)
		if err != nil {
			// TODO(cw): should this really return an error and possibly fail the entire operation?
			return nil, grpc.Errorf(codes.FailedPrecondition, "cannot parse creation time: %v", err)
		}

		var phase v1.WorkspaceInstanceStatus_Phase
		switch wsi.Status.Phase {
		case "unknown":
			phase = v1.WorkspaceInstanceStatus_PHASE_UNSPECIFIED
		case "preparing":
			phase = v1.WorkspaceInstanceStatus_PHASE_PREPARING
		case "building":
			phase = v1.WorkspaceInstanceStatus_PHASE_IMAGEBUILD
		case "pending":
			phase = v1.WorkspaceInstanceStatus_PHASE_PENDING
		case "creating":
			phase = v1.WorkspaceInstanceStatus_PHASE_CREATING
		case "initializing":
			phase = v1.WorkspaceInstanceStatus_PHASE_INITIALIZING
		case "running":
			phase = v1.WorkspaceInstanceStatus_PHASE_RUNNING
		case "interrupted":
			phase = v1.WorkspaceInstanceStatus_PHASE_INTERRUPTED
		case "stopping":
			phase = v1.WorkspaceInstanceStatus_PHASE_STOPPING
		case "stopped":
			phase = v1.WorkspaceInstanceStatus_PHASE_STOPPED
		default:
			// TODO(cw): should this really return an error and possibly fail the entire operation?
			return nil, grpc.Errorf(codes.FailedPrecondition, "cannot convert instance phase: %s", wsi.Status.Phase)
		}

		var admissionLevel v1.AdmissionLevel
		if input.Workspace.Shareable {
			admissionLevel = v1.AdmissionLevel_ADMISSION_LEVEL_EVERYONE
		} else {
			admissionLevel = v1.AdmissionLevel_ADMISSION_LEVEL_OWNER_ONLY
		}

		var firstUserActivity *timestamppb.Timestamp
		if fua := wsi.Status.Conditions.FirstUserActivity; fua != "" {
			firstUserActivity, _ = parseGitpodTimestamp(fua)
		}

		instance = &v1.WorkspaceInstance{
			InstanceId:  wsi.ID,
			WorkspaceId: wsi.WorkspaceID,
			CreatedAt:   creationTime,
			Status: &v1.WorkspaceInstanceStatus{
				StatusVersion: uint64(wsi.Status.Version),
				Phase:         phase,
				Message:       wsi.Status.Message,
				Url:           wsi.IdeURL,
				Admission:     admissionLevel,
				Conditions: &v1.WorkspaceInstanceStatus_Conditions{
					Failed:            wsi.Status.Conditions.Failed,
					Timeout:           wsi.Status.Conditions.Timeout,
					FirstUserActivity: firstUserActivity,
				},
			},
		}
	}

	return &v1.ListWorkspacesResponse_WorkspaceAndInstance{
		Result: &v1.Workspace{
			WorkspaceId: input.Workspace.ID,
			OwnerId:     input.Workspace.OwnerID,
			ProjectId:   "",
			Context: &v1.WorkspaceContext{
				ContextUrl: input.Workspace.ContextURL,
				Details: &v1.WorkspaceContext_Git_{Git: &v1.WorkspaceContext_Git{
					NormalizedContextUrl: input.Workspace.ContextURL,
					Commit:               "",
				}},
			},
			Description: input.Workspace.Description,
		},
		LastActiveInstances: instance,
	}, nil
}

func parseGitpodTimestamp(input string) (*timestamppb.Timestamp, error) {
	parsed, err := iso8601.ParseString(input)
	if err != nil {
		return nil, err
	}
	return timestamppb.New(parsed), nil
}
