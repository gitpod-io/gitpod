package supervisor

import (
	"context"

	"github.com/gitpod-io/gitpod/common-go/log"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/backup"

	"github.com/grpc-ecosystem/grpc-gateway/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// RegisterableService can register a service
type RegisterableService interface {
	// RegisterGRPC registers a gRPC service
	RegisterGRPC(*grpc.Server)
	// RegisterREST registers a REST service
	RegisterREST(*runtime.ServeMux) error
}

type statusService struct {
	IWH *backup.InWorkspaceHelper
}

func (s *statusService) RegisterGRPC(srv *grpc.Server) {
	api.RegisterStatusServiceServer(srv, s)
}

func (s *statusService) RegisterREST(mux *runtime.ServeMux) error {
	return api.RegisterStatusServiceHandlerServer(context.Background(), mux, s)
}

func (s *statusService) SupervisorStatus(context.Context, *api.SupervisorStatusRequest) (*api.SupervisorStatusResponse, error) {
	return &api.SupervisorStatusResponse{Ok: true}, nil
}

func (s *statusService) IDEStatus(context.Context, *api.IDEStatusRequest) (*api.IDEStatusResponse, error) {
	// TODO(cw): actually map this to the IDE status
	return &api.IDEStatusResponse{Ok: true}, nil
}

func (s *statusService) BackupStatus(ctx context.Context, req *api.BackupStatusRequest) (*api.BackupStatusResponse, error) {
	return &api.BackupStatusResponse{
		CanaryAvailable: s.IWH.CanaryAvailable(),
	}, nil
}

// ContentStatus provides feedback regarding the workspace content readiness
func (s *statusService) ContentStatus(ctx context.Context, req *api.ContentStatusRequest) (*api.ContentStatusResponse, error) {
	srcmap := map[csapi.WorkspaceInitSource]api.ContentSource{
		csapi.WorkspaceInitFromOther:    api.ContentSource_from_other,
		csapi.WorkspaceInitFromBackup:   api.ContentSource_from_backup,
		csapi.WorkspaceInitFromPrebuild: api.ContentSource_from_prebuild,
	}

	log.WithField("wait", req.Wait).Debug("ContentStatus called")
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
