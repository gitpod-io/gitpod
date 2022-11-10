// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"

	connect "github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	"github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus/ctxlogrus"
	"github.com/relvacode/iso8601"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func NewWorkspaceService(serverConnPool proxy.ServerConnectionPool) *WorkspaceService {
	return &WorkspaceService{
		connectionPool: serverConnPool,
	}
}

type WorkspaceService struct {
	connectionPool proxy.ServerConnectionPool

	v1connect.UnimplementedWorkspacesServiceHandler
}

func (s *WorkspaceService) GetWorkspace(ctx context.Context, req *connect.Request[v1.GetWorkspaceRequest]) (*connect.Response[v1.GetWorkspaceResponse], error) {
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	logger := ctxlogrus.Extract(ctx)

	server, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		logger.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	workspace, err := server.GetWorkspace(ctx, req.Msg.GetWorkspaceId())
	if err != nil {
		logger.WithError(err).Error("Failed to get workspace.")
		return nil, proxy.ConvertError(err)
	}

	instance, err := convertWorkspaceInstance(workspace)
	if err != nil {
		logger.WithError(err).Error("Failed to convert workspace instance.")
		instance = &v1.WorkspaceInstance{}
	}

	return connect.NewResponse(&v1.GetWorkspaceResponse{
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
			Status: &v1.WorkspaceStatus{
				Instance: instance,
			},
		},
	}), nil
}

func (s *WorkspaceService) GetOwnerToken(ctx context.Context, req *connect.Request[v1.GetOwnerTokenRequest]) (*connect.Response[v1.GetOwnerTokenResponse], error) {
	logger := ctxlogrus.Extract(ctx)
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	server, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		logger.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to establish connection to downstream services"))
	}

	ownerToken, err := server.GetOwnerToken(ctx, req.Msg.GetWorkspaceId())

	if err != nil {
		logger.WithError(err).Error("Failed to get owner token.")
		return nil, proxy.ConvertError(err)
	}

	return connect.NewResponse(&v1.GetOwnerTokenResponse{Token: ownerToken}), nil
}

func (s *WorkspaceService) ListWorkspaces(ctx context.Context, req *connect.Request[v1.ListWorkspacesRequest]) (*connect.Response[v1.ListWorkspacesResponse], error) {
	logger := ctxlogrus.Extract(ctx)
	token, err := auth.TokenFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No credentials present on request."))
	}

	server, err := s.connectionPool.Get(ctx, token)
	if err != nil {
		logger.WithError(err).Error("Failed to get connection to server.")
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to establish connection to downstream services"))
	}

	limit, err := getLimitFromPagination(req.Msg.GetPagination())
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

	res := make([]*v1.Workspace, 0, len(serverResp))
	for _, ws := range serverResp {
		workspace, err := convertWorkspaceInfo(ws)
		if err != nil {
			// convertWorkspaceInfo returns gRPC errors
			return nil, err
		}
		res = append(res, workspace)
	}

	return connect.NewResponse(
		&v1.ListWorkspacesResponse{
			Result: res,
		},
	), nil
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
		return 0, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid pagination page size (must be 0 < x < %d)", maxLimit))
	}

	return int(pagination.PageSize), nil
}

// convertWorkspaceInfo convers a "protocol workspace" to a "public API workspace". Returns gRPC errors if things go wrong.
func convertWorkspaceInfo(input *protocol.WorkspaceInfo) (*v1.Workspace, error) {
	instance, err := convertWorkspaceInstance(input)
	if err != nil {
		return nil, err
	}
	return &v1.Workspace{
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
		Status: &v1.WorkspaceStatus{
			Instance: instance,
		},
	}, nil
}

func convertWorkspaceInstance(input *protocol.WorkspaceInfo) (*v1.WorkspaceInstance, error) {
	wsi := input.LatestInstance
	if wsi == nil {
		return nil, nil
	}

	creationTime, err := parseGitpodTimestamp(wsi.CreationTime)
	if err != nil {
		// TODO(cw): should this really return an error and possibly fail the entire operation?
		return nil, connect.NewError(connect.CodeFailedPrecondition, fmt.Errorf("cannot parse creation time: %v", err))
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
		return nil, connect.NewError(connect.CodeFailedPrecondition, fmt.Errorf("cannot convert instance phase: %s", wsi.Status.Phase))
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

	return &v1.WorkspaceInstance{
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
	}, nil
}

func parseGitpodTimestamp(input string) (*timestamppb.Timestamp, error) {
	parsed, err := iso8601.ParseString(input)
	if err != nil {
		return nil, err
	}
	return timestamppb.New(parsed), nil
}
