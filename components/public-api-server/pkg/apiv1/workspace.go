// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"

	"path/filepath"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
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
	workspaceID, err := validateWorkspaceID(ctx, req.Msg.GetWorkspaceId())
	if err != nil {
		return nil, err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	ws, err := conn.GetWorkspace(ctx, workspaceID)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to get workspace.")
		return nil, proxy.ConvertError(err)
	}

	workspace, err := convertWorkspaceInfo(ws)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to convert workspace.")
		return nil, err
	}

	return connect.NewResponse(&v1.GetWorkspaceResponse{
		Result: workspace,
	}), nil
}

func (s *WorkspaceService) StreamWorkspaceStatus(ctx context.Context, req *connect.Request[v1.StreamWorkspaceStatusRequest], stream *connect.ServerStream[v1.StreamWorkspaceStatusResponse]) error {
	workspaceID, err := validateWorkspaceID(ctx, req.Msg.GetWorkspaceId())
	if err != nil {
		return err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return err
	}

	workspace, err := conn.GetWorkspace(ctx, workspaceID)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to get workspace.")
		return proxy.ConvertError(err)
	}

	if workspace.LatestInstance == nil {
		log.Extract(ctx).WithError(err).Error("Failed to get latest instance.")
		return connect.NewError(connect.CodeFailedPrecondition, fmt.Errorf("instance not found"))
	}

	ch, err := conn.WorkspaceUpdates(ctx, workspaceID)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to get workspace instance updates.")
		return proxy.ConvertError(err)
	}

	for update := range ch {
		instance, err := convertWorkspaceInstance(update, workspace.Workspace.Context, workspace.Workspace.Config, workspace.Workspace.Shareable)
		if err != nil {
			log.Extract(ctx).WithError(err).Error("Failed to convert workspace instance.")
			return proxy.ConvertError(err)
		}
		err = stream.Send(&v1.StreamWorkspaceStatusResponse{
			Result: &v1.WorkspaceStatus{
				Instance: instance,
			},
		})
		if err != nil {
			log.Extract(ctx).WithError(err).Error("Failed to stream workspace status.")
			return proxy.ConvertError(err)
		}
	}

	return nil
}

func (s *WorkspaceService) GetOwnerToken(ctx context.Context, req *connect.Request[v1.GetOwnerTokenRequest]) (*connect.Response[v1.GetOwnerTokenResponse], error) {
	workspaceID, err := validateWorkspaceID(ctx, req.Msg.GetWorkspaceId())
	if err != nil {
		return nil, err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	ownerToken, err := conn.GetOwnerToken(ctx, workspaceID)

	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to get owner token.")
		return nil, proxy.ConvertError(err)
	}

	return connect.NewResponse(&v1.GetOwnerTokenResponse{Token: ownerToken}), nil
}

func (s *WorkspaceService) ListWorkspaces(ctx context.Context, req *connect.Request[v1.ListWorkspacesRequest]) (*connect.Response[v1.ListWorkspacesResponse], error) {
	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	limit, err := getLimitFromPagination(req.Msg.GetPagination())
	if err != nil {
		// getLimitFromPagination returns gRPC errors
		return nil, err
	}
	serverResp, err := conn.GetWorkspaces(ctx, &protocol.GetWorkspacesOptions{
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

func (s *WorkspaceService) UpdatePort(ctx context.Context, req *connect.Request[v1.UpdatePortRequest]) (*connect.Response[v1.UpdatePortResponse], error) {
	workspaceID, err := validateWorkspaceID(ctx, req.Msg.GetWorkspaceId())
	if err != nil {
		return nil, err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	var portVisibility string
	var portProtocol string

	switch req.Msg.GetPort().GetPolicy() {
	case v1.PortPolicy_PORT_POLICY_PRIVATE:
		portVisibility = protocol.PortVisibilityPrivate
	case v1.PortPolicy_PORT_POLICY_PUBLIC:
		portVisibility = protocol.PortVisibilityPublic
	default:
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Unknown port policy specified."))
	}
	switch req.Msg.GetPort().GetProtocol() {
	case v1.PortProtocol_PORT_PROTOCOL_HTTP, v1.PortProtocol_PORT_PROTOCOL_UNSPECIFIED:
		portProtocol = protocol.PortProtocolHTTP
	case v1.PortProtocol_PORT_PROTOCOL_HTTPS:
		portProtocol = protocol.PortProtocolHTTPS
	default:
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("Unknown port protocol specified."))
	}
	_, err = conn.OpenPort(ctx, workspaceID, &protocol.WorkspaceInstancePort{
		Port:       float64(req.Msg.Port.Port),
		Visibility: portVisibility,
		Protocol:   portProtocol,
	})
	if err != nil {
		log.Extract(ctx).Error("Failed to update port")
		return nil, proxy.ConvertError(err)
	}

	return connect.NewResponse(
		&v1.UpdatePortResponse{},
	), nil
}

func (s *WorkspaceService) StartWorkspace(ctx context.Context, req *connect.Request[v1.StartWorkspaceRequest]) (*connect.Response[v1.StartWorkspaceResponse], error) {
	workspaceID, err := validateWorkspaceID(ctx, req.Msg.GetWorkspaceId())
	if err != nil {
		return nil, err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	_, err = conn.StartWorkspace(ctx, workspaceID, &protocol.StartWorkspaceOptions{})
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to start workspace.")
		return nil, proxy.ConvertError(err)
	}

	ws, err := conn.GetWorkspace(ctx, workspaceID)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to get workspace.")
		return nil, proxy.ConvertError(err)
	}

	workspace, err := convertWorkspaceInfo(ws)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to convert workspace.")
		return nil, err
	}

	return connect.NewResponse(&v1.StartWorkspaceResponse{Result: workspace}), nil
}

func (s *WorkspaceService) StopWorkspace(ctx context.Context, req *connect.Request[v1.StopWorkspaceRequest]) (*connect.Response[v1.StopWorkspaceResponse], error) {
	workspaceID, err := validateWorkspaceID(ctx, req.Msg.GetWorkspaceId())
	if err != nil {
		return nil, err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	err = conn.StopWorkspace(ctx, workspaceID)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to stop workspace.")
		return nil, proxy.ConvertError(err)
	}

	ws, err := conn.GetWorkspace(ctx, workspaceID)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to get workspace.")
		return nil, proxy.ConvertError(err)
	}

	workspace, err := convertWorkspaceInfo(ws)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to convert workspace.")
		return nil, err
	}

	return connect.NewResponse(&v1.StopWorkspaceResponse{Result: workspace}), nil
}

func (s *WorkspaceService) DeleteWorkspace(ctx context.Context, req *connect.Request[v1.DeleteWorkspaceRequest]) (*connect.Response[v1.DeleteWorkspaceResponse], error) {
	workspaceID, err := validateWorkspaceID(ctx, req.Msg.GetWorkspaceId())
	if err != nil {
		return nil, err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	err = conn.DeleteWorkspace(ctx, workspaceID)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to delete workspace.")
		return nil, proxy.ConvertError(err)
	}

	return connect.NewResponse(&v1.DeleteWorkspaceResponse{}), nil
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
	instance, err := convertWorkspaceInstance(input.LatestInstance, input.Workspace.Context, input.Workspace.Config, input.Workspace.Shareable)
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
				NormalizedContextUrl: input.Workspace.Context.NormalizedContextURL,
				Commit:               "",
			}},
		},
		Description: input.Workspace.Description,
		Status: &v1.WorkspaceStatus{
			Instance: instance,
		},
	}, nil
}

func convertWorkspaceInstance(wsi *protocol.WorkspaceInstance, wsCtx *protocol.WorkspaceContext, config *protocol.WorkspaceConfig, shareable bool) (*v1.WorkspaceInstance, error) {
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
	if shareable {
		admissionLevel = v1.AdmissionLevel_ADMISSION_LEVEL_EVERYONE
	} else {
		admissionLevel = v1.AdmissionLevel_ADMISSION_LEVEL_OWNER_ONLY
	}

	var firstUserActivity *timestamppb.Timestamp
	if fua := wsi.Status.Conditions.FirstUserActivity; fua != "" {
		firstUserActivity, _ = parseGitpodTimestamp(fua)
	}

	var ports []*v1.Port
	for _, p := range wsi.Status.ExposedPorts {
		port := &v1.Port{
			Port: uint64(p.Port),
			Url:  p.URL,
		}
		if p.Visibility == protocol.PortVisibilityPublic {
			port.Policy = v1.PortPolicy_PORT_POLICY_PUBLIC
		} else {
			port.Policy = v1.PortPolicy_PORT_POLICY_PRIVATE
		}
		if p.Protocol == protocol.PortProtocolHTTPS {
			port.Protocol = v1.PortProtocol_PORT_PROTOCOL_HTTPS
		} else {
			port.Protocol = v1.PortProtocol_PORT_PROTOCOL_HTTP
		}

		ports = append(ports, port)
	}

	// Calculate initial workspace folder location
	var recentFolders []string
	location := ""
	if config != nil {
		location = config.WorkspaceLocation
		if location == "" {
			location = config.CheckoutLocation
		}
	}
	if location == "" && wsCtx != nil && wsCtx.Repository != nil {
		location = wsCtx.Repository.Name

	}
	recentFolders = append(recentFolders, filepath.Join("/workspace", location))

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
			Ports:         ports,
			RecentFolders: recentFolders,
		},
	}, nil
}
