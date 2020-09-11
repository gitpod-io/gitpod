package supervisor

import (
	"context"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/backup"

	"github.com/grpc-ecosystem/grpc-gateway/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// RegisterableService can register a service
type RegisterableService interface{}

// RegisterableGRPCService can register gRPC services
type RegisterableGRPCService interface {
	// RegisterGRPC registers a gRPC service
	RegisterGRPC(*grpc.Server)
}

// RegisterableRESTService can register REST services
type RegisterableRESTService interface {
	// RegisterREST registers a REST service
	RegisterREST(mux *runtime.ServeMux, grpcEndpoint string) error
}

type statusService struct {
	IWH      *backup.InWorkspaceHelper
	Ports    *portsManager
	IDEReady <-chan struct{}
}

func (s *statusService) RegisterGRPC(srv *grpc.Server) {
	api.RegisterStatusServiceServer(srv, s)
}

func (s *statusService) RegisterREST(mux *runtime.ServeMux, grpcEndpoint string) error {
	return api.RegisterStatusServiceHandlerFromEndpoint(context.Background(), mux, grpcEndpoint, []grpc.DialOption{grpc.WithInsecure()})
}

func (s *statusService) SupervisorStatus(context.Context, *api.SupervisorStatusRequest) (*api.SupervisorStatusResponse, error) {
	return &api.SupervisorStatusResponse{Ok: true}, nil
}

func (s *statusService) IDEStatus(ctx context.Context, req *api.IDEStatusRequest) (*api.IDEStatusResponse, error) {
	if req.Wait {
		select {
		case <-s.IDEReady:
			return &api.IDEStatusResponse{Ok: true}, nil
		case <-ctx.Done():
			return nil, status.Error(codes.DeadlineExceeded, ctx.Err().Error())
		}
	}

	var ok bool
	select {
	case <-s.IDEReady:
		ok = true
	default:
		ok = false
	}
	return &api.IDEStatusResponse{Ok: ok}, nil
}

// ContentStatus provides feedback regarding the workspace content readiness
func (s *statusService) ContentStatus(ctx context.Context, req *api.ContentStatusRequest) (*api.ContentStatusResponse, error) {
	srcmap := map[csapi.WorkspaceInitSource]api.ContentSource{
		csapi.WorkspaceInitFromOther:    api.ContentSource_from_other,
		csapi.WorkspaceInitFromBackup:   api.ContentSource_from_backup,
		csapi.WorkspaceInitFromPrebuild: api.ContentSource_from_prebuild,
	}

	if req.Wait {
		select {
		case <-s.IWH.ContentReady():
			src, _ := s.IWH.ContentSource()
			return &api.ContentStatusResponse{
				Available: true,
				Source:    srcmap[src],
			}, nil
		case <-ctx.Done():
			return nil, status.Error(codes.DeadlineExceeded, ctx.Err().Error())
		}
	}

	src, ok := s.IWH.ContentSource()
	if !ok {
		return &api.ContentStatusResponse{
			Available: false,
		}, nil
	}

	return &api.ContentStatusResponse{
		Available: true,
		Source:    srcmap[src],
	}, nil
}

func (s *statusService) BackupStatus(ctx context.Context, req *api.BackupStatusRequest) (*api.BackupStatusResponse, error) {
	return &api.BackupStatusResponse{
		CanaryAvailable: s.IWH.CanaryAvailable(),
	}, nil
}

func (s *statusService) PortsStatus(req *api.PortsStatusRequest, srv api.StatusService_PortsStatusServer) error {
	err := srv.Send(&api.PortsStatusResponse{
		Ports: s.Ports.ServedPorts(),
	})
	if err != nil {
		return err
	}
	if !req.Observe {
		return nil
	}

	sub := s.Ports.Subscribe()
	if sub == nil {
		return status.Error(codes.ResourceExhausted, "too many subscriptions")
	}
	defer sub.Close()

	for {
		select {
		case <-srv.Context().Done():
			return nil
		case update := <-sub.Updates():
			if update == nil {
				return nil
			}
			err := srv.Send(&api.PortsStatusResponse{Ports: update})
			if err != nil {
				return err
			}
		}
	}
}
