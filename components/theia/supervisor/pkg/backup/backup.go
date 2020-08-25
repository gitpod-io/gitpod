// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package backup

import (
	"context"
	"net/http"
	"sync/atomic"

	"github.com/gitpod-io/gitpod/common-go/log"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/git"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	wssync "github.com/gitpod-io/gitpod/ws-sync/api"

	"github.com/grpc-ecosystem/grpc-gateway/runtime"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ContentState signals the workspace content state
type ContentState interface {
	MarkContentReady(src csapi.WorkspaceInitSource)
	ContentReady() <-chan struct{}
	ContentSource() (src csapi.WorkspaceInitSource, ok bool)
}

// NewInWorkspaceHelper produces a new NewInWorkspaceHelper
func NewInWorkspaceHelper(checkoutLocation string, pauseTheia chan<- bool) *InWorkspaceHelper {
	return &InWorkspaceHelper{
		checkoutLocation: checkoutLocation,
		contentReadyChan: make(chan struct{}),
		pauseChan:        pauseTheia,
		triggerBackup:    make(chan chan<- bool),
	}
}

// InWorkspaceHelper implements the in-workspace helper for ws-sync
type InWorkspaceHelper struct {
	checkoutLocation string
	pauseChan        chan<- bool
	triggerBackup    chan chan<- bool

	contentReadyChan chan struct{}
	contentSource    csapi.WorkspaceInitSource

	canaryAvailable int32
}

// MarkContentReady marks the workspace content as available.
// This function is not synchronized and must be called from a single thread/go routine only.
func (iwh *InWorkspaceHelper) MarkContentReady(src csapi.WorkspaceInitSource) {
	iwh.contentSource = src
	close(iwh.contentReadyChan)
}

// ContentReady returns a chan that closes when the content becomes available
func (iwh *InWorkspaceHelper) ContentReady() <-chan struct{} {
	return iwh.contentReadyChan
}

// ContentSource returns the init source of the workspace content.
// The value returned here is only OK after ContentReady() was closed.
func (iwh *InWorkspaceHelper) ContentSource() (src csapi.WorkspaceInitSource, ok bool) {
	select {
	case <-iwh.contentReadyChan:
	default:
		return "", false
	}
	return iwh.contentSource, true
}

// PrepareBackup prepares a workspace content backup, e.g. when the container is about to shut down
func (iwh *InWorkspaceHelper) PrepareBackup(ctx context.Context) error {
	rc := make(chan bool)

	select {
	case iwh.triggerBackup <- rc:
	case <-ctx.Done():
		return ctx.Err()
	default:
		return xerrors.Errorf("no backup canary available")
	}

	select {
	case success := <-rc:
		if !success {
			return xerrors.Errorf("backup preparation failed")
		}
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// HTTPMux produces an HTTP handler serving supervisor's REST API
func (iwh *InWorkspaceHelper) HTTPMux(grpcEndpoint string) http.Handler {
	mux := runtime.NewServeMux(
		runtime.WithMarshalerOption(runtime.MIMEWildcard, &runtime.JSONPb{EnumsAsInts: false, EmitDefaults: true}),
	)
	err := supervisor.RegisterBackupServiceHandlerFromEndpoint(context.Background(), mux, grpcEndpoint, []grpc.DialOption{grpc.WithInsecure()})
	if err != nil {
		log.WithError(err).Error("cannot register REST API service handler")
	}
	return mux
}

// Register registers an InWorkspaceHelperServer gRPC service using this helper implementation
func (iwh *InWorkspaceHelper) Register(srv *grpc.Server) {
	wssync.RegisterInWorkspaceHelperServer(srv, &iwhserver{iwh})
	supervisor.RegisterBackupServiceServer(srv, &wsserver{iwh})
}

type wsserver struct {
	*InWorkspaceHelper
}

func (wss *wsserver) Prepare(ctx context.Context, req *supervisor.PrepareBackupRequest) (*supervisor.PrepareBackupResponse, error) {
	err := wss.PrepareBackup(ctx)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &supervisor.PrepareBackupResponse{}, nil
}

func (wss *wsserver) Status(ctx context.Context, req *supervisor.StatusRequest) (*supervisor.StatusResponse, error) {
	return &supervisor.StatusResponse{
		CanaryAvailable: atomic.LoadInt32(&wss.canaryAvailable) > 0,
	}, nil
}

func (wss *wsserver) DebugPauseTheia(ctx context.Context, req *supervisor.DebugPauseTheiaRequest) (*supervisor.DebugPauseTheiaResponse, error) {
	wss.pauseChan <- true
	return &supervisor.DebugPauseTheiaResponse{}, nil
}

func (wss *wsserver) ContentStatus(ctx context.Context, req *supervisor.ContentStatusRequest) (*supervisor.ContentStatusResponse, error) {
	srcmap := map[csapi.WorkspaceInitSource]supervisor.ContentSource{
		csapi.WorkspaceInitFromOther:    supervisor.ContentSource_from_other,
		csapi.WorkspaceInitFromBackup:   supervisor.ContentSource_from_backup,
		csapi.WorkspaceInitFromPrebuild: supervisor.ContentSource_from_prebuild,
	}

	log.WithField("source", wss.contentSource).WithField("wait", req.Wait).Debug("ContentStatus called")
	if req.Wait {
		select {
		case <-wss.ContentReady():
			return &supervisor.ContentStatusResponse{
				Available: true,
				Source:    srcmap[wss.contentSource],
			}, nil
		case <-ctx.Done():
			return nil, status.Error(codes.Aborted, ctx.Err().Error())
		}
	}

	select {
	case <-wss.contentReadyChan:
		return &supervisor.ContentStatusResponse{
			Available: true,
			Source:    srcmap[wss.contentSource],
		}, nil
	default:
		return &supervisor.ContentStatusResponse{
			Available: false,
		}, nil
	}
}

type iwhserver struct {
	*InWorkspaceHelper
}

// BackupCanary can prepare workspace content backups. The canary is supposed to be triggered
// when the workspace is about to shut down, e.g. using the PreStop hook of a Kubernetes container.
func (iwh *iwhserver) BackupCanary(srv wssync.InWorkspaceHelper_BackupCanaryServer) error {
	atomic.AddInt32(&iwh.canaryAvailable, 1)
	defer atomic.AddInt32(&iwh.canaryAvailable, -1)

	rc := <-iwh.triggerBackup
	if rc == nil {
		return status.Error(codes.FailedPrecondition, "trigger chan closed")
	}

	err := srv.Send(&wssync.BackupCanaryRequest{})
	if err != nil {
		return err
	}

	req, err := srv.Recv()
	if err != nil {
		log.WithError(err).Error("backup prep failed")
		rc <- false
	}
	rc <- req.Success

	return nil
}

// PauseTheia can pause the Theia process and all its children. As long as the request stream
// is held Theia will be paused.
// This is a stop-the-world mechanism for preventing concurrent modification during backup.
func (iwh *iwhserver) PauseTheia(srv wssync.InWorkspaceHelper_PauseTheiaServer) error {
	iwh.pauseChan <- true
	defer func() {
		iwh.pauseChan <- false
	}()

	_, err := srv.Recv()
	if err != nil {
		return err
	}

	return srv.SendAndClose(&wssync.PauseTheiaResponse{})
}

const (
	// maxPendingChanges is the limit beyond which we no longer report pending changes.
	// For example, if a workspace has then 150 untracked files, we'll report the first
	// 100 followed by "... and 50 more".
	//
	// We do this to keep the load on our infrastructure light and because beyond this number
	// the changes are irrelevant anyways.
	maxPendingChanges = 100
)

// GitStatus provides the current state of the main Git repo at the workspace's checkout location
func (iwh *iwhserver) GitStatus(ctx context.Context, req *wssync.GitStatusRequest) (*wssync.GitStatusResponse, error) {
	//
	// BEWARE
	// This functionality is duplicated in ws-sync.
	// When we make the backup work without the PLIS we should de-duplicate this implementation.
	//

	cl := &git.Client{Location: iwh.checkoutLocation}
	s, err := cl.Status(ctx)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	res := s.ToAPI()
	return &wssync.GitStatusResponse{Repo: res}, nil
}
