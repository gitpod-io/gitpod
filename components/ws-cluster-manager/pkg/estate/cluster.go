// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package estate

import (
	"context"
	"errors"
	"time"

	connect "github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/ws-cluster-manager/api/v1"
	"github.com/gitpod-io/gitpod/components/ws-cluster-manager/api/v1/v1connect"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/durationpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func NewClusterService() *ClusterService {
	return &ClusterService{
		Workspaces: NewInMemoryDatabase[v1.Workspace](),
	}
}

type ClusterService struct {
	Workspaces Database[v1.Workspace]
}

func (srv *ClusterService) WorkspaceManagerServer() api.WorkspaceManagerServer {
	return &workspaceManagerServer{
		Workspaces: srv.Workspaces,
	}
}

func (srv *ClusterService) ClusterServiceHandler() v1connect.ClusterServiceHandler {
	return &clusterService{
		Workspaces: srv.Workspaces,
	}
}

type clusterService struct {
	Workspaces Database[v1.Workspace]
	v1connect.UnimplementedClusterServiceHandler
}

// Notify implements v1connect.ClusterServiceHandler.
func (srv *clusterService) Notify(ctx context.Context, req *connect.Request[v1.NotifyRequest], resp *connect.ServerStream[v1.NotifyResponse]) error {
	for token := range srv.Workspaces.Notifications() {
		err := resp.Send(&v1.NotifyResponse{
			StateToken: token,
		})
		if err != nil {
			return err
		}
	}
	return nil
}

// PullSpecs implements v1connect.ClusterServiceHandler.
func (srv *clusterService) PullSpecs(ctx context.Context, req *connect.Request[v1.PullSpecsRequest]) (*connect.Response[v1.PullSpecsResponse], error) {
	resp, err := srv.Workspaces.List(ctx, req.Msg.StateToken)
	if err != nil {
		return nil, err
	}
	resources := make([]*v1.Resource, 0, len(resp))
	for _, r := range resp {
		resources = append(resources, &v1.Resource{
			Resource: &v1.Resource_Workspace{
				Workspace: r,
			},
		})
	}
	return &connect.Response[v1.PullSpecsResponse]{
		Msg: &v1.PullSpecsResponse{
			Resources: resources,
		},
	}, nil
}

type workspaceManagerServer struct {
	Workspaces Database[v1.Workspace]
	api.UnimplementedWorkspaceManagerServer
}

// BackupWorkspace implements api.WorkspaceManagerServer.
// func (srv *workspaceManagerServer) BackupWorkspace(context.Context, *api.BackupWorkspaceRequest) (*api.BackupWorkspaceResponse, error) { }

// ControlAdmission implements api.WorkspaceManagerServer.
func (srv *workspaceManagerServer) ControlAdmission(ctx context.Context, req *api.ControlAdmissionRequest) (*api.ControlAdmissionResponse, error) {
	err := srv.Workspaces.UpdateResource(ctx, req.Id, func(ws *v1.Workspace) (update bool, err error) {
		if ws == nil {
			return false, status.Error(codes.NotFound, "workspace not found")
		}

		switch req.Level {
		case api.AdmissionLevel_ADMIT_EVERYONE:
			ws.Spec.Admission = v1.AdmissionLevel_ADMISSION_LEVEL_EVERYONE
		case api.AdmissionLevel_ADMIT_OWNER_ONLY:
			ws.Spec.Admission = v1.AdmissionLevel_ADMISSION_LEVEL_OWNER_ONLY
		default:
			return false, status.Error(codes.InvalidArgument, "invalid admission level")
		}
		return true, nil
	})
	if err != nil {
		return nil, err
	}
	return &api.ControlAdmissionResponse{}, nil
}

// ControlPort implements api.WorkspaceManagerServer.
func (srv *workspaceManagerServer) ControlPort(ctx context.Context, req *api.ControlPortRequest) (*api.ControlPortResponse, error) {
	err := srv.Workspaces.UpdateResource(ctx, req.Id, func(ws *v1.Workspace) (update bool, err error) {
		idx := -1
		for i, p := range ws.Spec.Ports {
			if p.Port == req.Spec.Port {
				idx = i
				break
			}
		}
		if idx == -1 {
			ws.Spec.Ports = append(ws.Spec.Ports, &v1.PortSpec{
				Port:      req.Spec.Port,
				Admission: v1.AdmissionLevel_ADMISSION_LEVEL_EVERYONE,
			})
			update = true
			return
		}

		switch req.Spec.Visibility {
		case api.PortVisibility_PORT_VISIBILITY_PUBLIC:
			ws.Spec.Ports[idx].Admission = v1.AdmissionLevel_ADMISSION_LEVEL_EVERYONE
		case api.PortVisibility_PORT_VISIBILITY_PRIVATE:
			ws.Spec.Ports[idx].Admission = v1.AdmissionLevel_ADMISSION_LEVEL_OWNER_ONLY
		default:
			return false, status.Error(codes.InvalidArgument, "invalid admission level")
		}
		return true, nil
	})
	if err != nil {
		return nil, err
	}
	return &api.ControlPortResponse{}, nil
}

// DeleteVolumeSnapshot implements api.WorkspaceManagerServer.
// func (srv *workspaceManagerServer) DeleteVolumeSnapshot(context.Context, *api.DeleteVolumeSnapshotRequest) (*api.DeleteVolumeSnapshotResponse, error) {}

// DescribeCluster implements api.WorkspaceManagerServer.
func (srv *workspaceManagerServer) DescribeCluster(context.Context, *api.DescribeClusterRequest) (*api.DescribeClusterResponse, error) {
	panic("unimplemented")
}

// DescribeWorkspace implements api.WorkspaceManagerServer.
func (srv *workspaceManagerServer) DescribeWorkspace(ctx context.Context, req *api.DescribeWorkspaceRequest) (*api.DescribeWorkspaceResponse, error) {
	ws, err := srv.Workspaces.Get(ctx, req.Id)
	if err != nil {
		return nil, err
	}
	if ws == nil {
		return nil, status.Error(codes.NotFound, "workspace not found")
	}

	return &api.DescribeWorkspaceResponse{
		Status: convertWorkspaceToV1(ws),
	}, nil
}

func convertWorkspaceToV1(ws *v1.Workspace) *api.WorkspaceStatus {
	var phase api.WorkspacePhase
	switch ws.Status.Phase {
	case v1.WorkspacePhase_WORKSPACE_PHASE_CREATING:
		phase = api.WorkspacePhase_CREATING
	case v1.WorkspacePhase_WORKSPACE_PHASE_RUNNING:
		phase = api.WorkspacePhase_RUNNING
	case v1.WorkspacePhase_WORKSPACE_PHASE_STOPPING:
		phase = api.WorkspacePhase_STOPPING
	case v1.WorkspacePhase_WORKSPACE_PHASE_STOPPED:
		phase = api.WorkspacePhase_STOPPED
	case v1.WorkspacePhase_WORKSPACE_PHASE_INITIALIZING:
		phase = api.WorkspacePhase_INITIALIZING
	case v1.WorkspacePhase_WORKSPACE_PHASE_PENDING:
		phase = api.WorkspacePhase_PENDING
	default:
		phase = api.WorkspacePhase_UNKNOWN
	}
	return &api.WorkspaceStatus{
		Id:            ws.Metadata.Name,
		StatusVersion: uint64(time.Now().UnixMicro()),
		Metadata: &api.WorkspaceMetadata{
			Owner:       ws.Metadata.Owner,
			MetaId:      ws.Metadata.Name,
			Annotations: ws.Metadata.Annotations,
			Team:        &ws.Metadata.Organization,
		},
		Spec: &api.WorkspaceSpec{
			Headless: false,
			Url:      ws.Status.Url,
			Type:     api.WorkspaceType_REGULAR,
			Class:    ws.Spec.Class,
			Timeout:  ws.Spec.Timeout.AsDuration().String(),
		},
		Phase: phase,
	}
}

// GetWorkspaces implements api.WorkspaceManagerServer.
func (srv *workspaceManagerServer) GetWorkspaces(ctx context.Context, req *api.GetWorkspacesRequest) (*api.GetWorkspacesResponse, error) {
	wss, err := srv.Workspaces.List(ctx, "")
	if err != nil {
		return nil, err
	}
	var workspaces []*api.WorkspaceStatus
	for _, ws := range wss {
		workspaces = append(workspaces, convertWorkspaceToV1(ws))
	}
	return &api.GetWorkspacesResponse{
		Status: workspaces,
	}, nil
}

// MarkActive implements api.WorkspaceManagerServer.
func (srv *workspaceManagerServer) MarkActive(context.Context, *api.MarkActiveRequest) (*api.MarkActiveResponse, error) {
	return &api.MarkActiveResponse{}, nil
}

// SetTimeout implements api.WorkspaceManagerServer.
func (srv *workspaceManagerServer) SetTimeout(ctx context.Context, req *api.SetTimeoutRequest) (*api.SetTimeoutResponse, error) {
	err := srv.Workspaces.UpdateResource(ctx, req.Id, func(ws *v1.Workspace) (update bool, err error) {
		if ws == nil {
			return false, status.Error(codes.NotFound, "workspace not found")
		}

		dur, err := time.ParseDuration(req.Duration)
		if err != nil {
			return false, status.Errorf(codes.InvalidArgument, "invalid duration: %w", err)
		}

		ws.Spec.Timeout = durationpb.New(dur)
		return true, nil
	})
	if err != nil {
		return nil, err
	}
	return &api.SetTimeoutResponse{}, nil
}

// StartWorkspace implements api.WorkspaceManagerServer.
func (srv *workspaceManagerServer) StartWorkspace(ctx context.Context, req *api.StartWorkspaceRequest) (*api.StartWorkspaceResponse, error) {
	envvars := make([]*v1.EnvironmentVariable, 0, len(req.Spec.Envvars))
	for _, v := range req.Spec.Envvars {
		envvars = append(envvars, &v1.EnvironmentVariable{
			Name:  v.Name,
			Value: v.Value,
		})
	}
	ports := make([]*v1.PortSpec, 0, len(req.Spec.Ports))
	for _, p := range req.Spec.Ports {
		var admission v1.AdmissionLevel
		switch p.Visibility {
		case api.PortVisibility_PORT_VISIBILITY_PUBLIC:
			admission = v1.AdmissionLevel_ADMISSION_LEVEL_EVERYONE
		case api.PortVisibility_PORT_VISIBILITY_PRIVATE:
			admission = v1.AdmissionLevel_ADMISSION_LEVEL_OWNER_ONLY
		default:
			return nil, status.Errorf(codes.InvalidArgument, "invalid admission level for port %d", p.Port)
		}
		ports = append(ports, &v1.PortSpec{
			Port:      p.Port,
			Admission: admission,
		})
	}
	var admission v1.AdmissionLevel
	switch req.Spec.Admission {
	case api.AdmissionLevel_ADMIT_EVERYONE:
		admission = v1.AdmissionLevel_ADMISSION_LEVEL_EVERYONE
	case api.AdmissionLevel_ADMIT_OWNER_ONLY:
		admission = v1.AdmissionLevel_ADMISSION_LEVEL_OWNER_ONLY
	default:
		return nil, status.Errorf(codes.InvalidArgument, "invalid admission level for workspace")
	}
	timeout, err := time.ParseDuration(req.Spec.Timeout)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid timeout: %w", err)
	}

	initializer, err := proto.Marshal(req.Spec.Initializer)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid initializer: %w", err)
	}

	err = srv.Workspaces.Create(ctx, req.Id, &v1.Workspace{
		Metadata: &v1.ResourceMetadata{
			Name:         req.Id,
			Owner:        req.Metadata.Owner,
			Annotations:  req.Metadata.Annotations,
			Organization: *req.Metadata.Team,
			CreationTime: timestamppb.Now(),
		},
		Spec: &v1.WorkspaceSpec{
			Type:      v1.WorkspaceType_WORKSPACE_TYPE_REGULAR,
			Class:     req.Spec.Class,
			Envvars:   envvars,
			Ports:     ports,
			Admission: admission,
			Git: &v1.GitSpec{
				Username: req.Spec.Git.Username,
				Email:    req.Spec.Git.Email,
			},
			SshPublicKeys: req.Spec.SshPublicKeys,
			Timeout:       durationpb.New(timeout),
			Initializer:   initializer,
		},
	})
	if errors.Is(err, ErrAlreadyExists) {
		return nil, status.Error(codes.AlreadyExists, "workspace already exists")
	}
	if err != nil {
		return nil, err
	}
	return &api.StartWorkspaceResponse{
		Url:        "http://localhost:19876",
		OwnerToken: "123789",
	}, nil
}

// StopWorkspace implements api.WorkspaceManagerServer.
// func (srv *workspaceManagerServer) StopWorkspace(context.Context, *api.StopWorkspaceRequest) (*api.StopWorkspaceResponse, error) {

// }

// Subscribe implements api.WorkspaceManagerServer.
func (srv *workspaceManagerServer) Subscribe(*api.SubscribeRequest, api.WorkspaceManager_SubscribeServer) error {
	panic("unimplemented")
}

// TakeSnapshot implements api.WorkspaceManagerServer.
func (srv *workspaceManagerServer) TakeSnapshot(context.Context, *api.TakeSnapshotRequest) (*api.TakeSnapshotResponse, error) {
	panic("unimplemented")
}

// UpdateSSHKey implements api.WorkspaceManagerServer.
func (srv *workspaceManagerServer) UpdateSSHKey(ctx context.Context, req *api.UpdateSSHKeyRequest) (*api.UpdateSSHKeyResponse, error) {
	err := srv.Workspaces.UpdateResource(ctx, req.Id, func(ws *v1.Workspace) (update bool, err error) {
		if ws == nil {
			return false, status.Error(codes.NotFound, "workspace not found")
		}

		ws.Spec.SshPublicKeys = req.Keys
		return true, nil
	})
	if err != nil {
		return nil, err
	}
	return &api.UpdateSSHKeyResponse{}, nil
}
