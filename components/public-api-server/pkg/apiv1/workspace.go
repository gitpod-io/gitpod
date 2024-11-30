// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"

	"path/filepath"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func NewWorkspaceService(serverConnPool proxy.ServerConnectionPool, expClient experiments.Client) *WorkspaceService {
	return &WorkspaceService{
		connectionPool: serverConnPool,
		expClient:      expClient,
	}
}

type WorkspaceService struct {
	connectionPool proxy.ServerConnectionPool
	expClient      experiments.Client

	v1connect.UnimplementedWorkspacesServiceHandler
}

func (s *WorkspaceService) CreateAndStartWorkspace(ctx context.Context, req *connect.Request[v1.CreateAndStartWorkspaceRequest]) (*connect.Response[v1.CreateAndStartWorkspaceResponse], error) {

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	ws, err := conn.CreateWorkspace(ctx, &protocol.CreateWorkspaceOptions{
		ContextURL:                         req.Msg.GetContextUrl(),
		OrganizationId:                     req.Msg.GetOrganizationId(),
		IgnoreRunningWorkspaceOnSameCommit: req.Msg.GetIgnoreRunningWorkspaceOnSameCommit(),
		IgnoreRunningPrebuild:              req.Msg.GetIgnoreRunningPrebuild(),
		AllowUsingPreviousPrebuilds:        req.Msg.GetAllowUsingPreviousPrebuilds(),
		ForceDefaultConfig:                 req.Msg.GetForceDefaultConfig(),
		StartWorkspaceOptions: protocol.StartWorkspaceOptions{
			WorkspaceClass: req.Msg.GetStartSpec().GetWorkspaceClass(),
			Region:         req.Msg.GetStartSpec().GetRegion(),
			IdeSettings: &protocol.IDESettings{
				DefaultIde:       req.Msg.StartSpec.IdeSettings.GetDefaultIde(),
				UseLatestVersion: req.Msg.StartSpec.IdeSettings.GetUseLatestVersion(),
			},
		},
	})
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to create workspace.")
		return nil, proxy.ConvertError(err)
	}

	return connect.NewResponse(&v1.CreateAndStartWorkspaceResponse{
		WorkspaceId: ws.CreatedWorkspaceID,
	}), nil
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

	workspace, err := s.convertWorkspaceInfo(ctx, ws)
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
		Limit:          float64(limit),
		OrganizationId: req.Msg.GetOrganizationId(),
	})
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	res := make([]*v1.Workspace, 0, len(serverResp))
	for _, ws := range serverResp {
		workspace, err := s.convertWorkspaceInfo(ctx, ws)
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

	workspace, err := s.convertWorkspaceInfo(ctx, ws)
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

	workspace, err := s.convertWorkspaceInfo(ctx, ws)
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

func (s *WorkspaceService) ListWorkspaceClasses(ctx context.Context, req *connect.Request[v1.ListWorkspaceClassesRequest]) (*connect.Response[v1.ListWorkspaceClassesResponse], error) {
	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	classes, err := conn.GetSupportedWorkspaceClasses(ctx)
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to get workspace classes.")
		return nil, proxy.ConvertError(err)
	}

	res := make([]*v1.WorkspaceClass, 0, len(classes))
	for _, c := range classes {
		res = append(res, &v1.WorkspaceClass{
			Id:          c.ID,
			DisplayName: c.DisplayName,
			Description: c.Description,
			IsDefault:   c.IsDefault,
		})
	}

	return connect.NewResponse(
		&v1.ListWorkspaceClassesResponse{
			Result: res,
		},
	), nil
}

func (s *WorkspaceService) GetDefaultWorkspaceImage(ctx context.Context, req *connect.Request[v1.GetDefaultWorkspaceImageRequest]) (*connect.Response[v1.GetDefaultWorkspaceImageResponse], error) {
	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}
	wsImage, err := conn.GetDefaultWorkspaceImage(ctx, &protocol.GetDefaultWorkspaceImageParams{
		WorkspaceID: req.Msg.GetWorkspaceId(),
	})
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to get default workspace image.")
		return nil, proxy.ConvertError(err)
	}

	source := v1.GetDefaultWorkspaceImageResponse_IMAGE_SOURCE_UNSPECIFIED
	if wsImage.Source == protocol.WorkspaceImageSourceInstallation {
		source = v1.GetDefaultWorkspaceImageResponse_IMAGE_SOURCE_INSTALLATION
	} else if wsImage.Source == protocol.WorkspaceImageSourceOrganization {
		source = v1.GetDefaultWorkspaceImageResponse_IMAGE_SOURCE_ORGANIZATION
	}

	return connect.NewResponse(&v1.GetDefaultWorkspaceImageResponse{
		Image:  wsImage.Image,
		Source: source,
	}), nil
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

func (s *WorkspaceService) convertWorkspaceInfo(ctx context.Context, input *protocol.WorkspaceInfo) (*v1.Workspace, error) {
	return convertWorkspaceInfo(input)
}

// convertWorkspaceInfo converts a "protocol workspace" to a "public API workspace". Returns gRPC errors if things go wrong.
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
				Repository: &v1.WorkspaceContext_Repository{
					Name:  input.Workspace.Context.Repository.Name,
					Owner: input.Workspace.Context.Repository.Owner,
				},
			}},
		},
		Description: input.Workspace.Description,
		Status: &v1.WorkspaceStatus{
			Instance: instance,
		},
	}, nil
}

func convertIdeConfig(ideConfig *protocol.WorkspaceInstanceIDEConfig) *v1.WorkspaceInstanceStatus_EditorReference {
	if ideConfig == nil {
		return nil
	}
	ideVersion := "stable"
	if ideConfig.UseLatest {
		ideVersion = "latest"
	}
	return &v1.WorkspaceInstanceStatus_EditorReference{
		Name:          ideConfig.IDE,
		Version:       ideVersion,
		PreferToolbox: ideConfig.PreferToolbox,
	}
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

	gitStatus := convertGitStatus(wsi.GitStatus)

	var editor *v1.WorkspaceInstanceStatus_EditorReference
	if wsi.Configuration != nil && wsi.Configuration.IDEConfig != nil {
		editor = convertIdeConfig(wsi.Configuration.IDEConfig)
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
			Ports:         ports,
			RecentFolders: recentFolders,
			GitStatus:     gitStatus,
			Editor:        editor,
		},
	}, nil
}

func convertGitStatus(repo *protocol.WorkspaceInstanceRepoStatus) *v1.GitStatus {
	if repo == nil {
		return nil
	}
	return &v1.GitStatus{
		Branch:               repo.Branch,
		LatestCommit:         repo.LatestCommit,
		TotalUncommitedFiles: int32(repo.TotalUncommitedFiles),
		TotalUntrackedFiles:  int32(repo.TotalUntrackedFiles),
		TotalUnpushedCommits: int32(repo.TotalUnpushedCommits),
		UncommitedFiles:      repo.UncommitedFiles,
		UntrackedFiles:       repo.UntrackedFiles,
		UnpushedCommits:      repo.UnpushedCommits,
	}
}
