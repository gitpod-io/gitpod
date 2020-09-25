package api

import (
	context "context"
	"sync/atomic"
)

// NewInWorkspaceHelper produces a new InWorkspaceHelper
func NewInWorkspaceHelper() *InWorkspaceHelper {
	return &InWorkspaceHelper{
		triggerUIDMap: make(chan *UidmapCanaryRequest),
		errchan:       make(chan error, 10),
	}
}

// InWorkspaceHelper implements InWorkspaceHelperServer
type InWorkspaceHelper struct {
	canaryAvailable int32

	triggerUIDMap chan *UidmapCanaryRequest
	errchan       chan error
}

// Server produces a registrable InWorkspaceHelper server
func (iwh *InWorkspaceHelper) Server() InWorkspaceHelperServer {
	return &iwhserver{iwh}
}

// CanaryAvailable returns true if there's a canaray available.
// If there isn't, calling Newuidmap or Newguidmap won't succeed.
func (iwh *InWorkspaceHelper) CanaryAvailable() bool {
	return atomic.LoadInt32(&iwh.canaryAvailable) > 0
}

// Newuidmap asks the canary to create a new uidmap. If there's no canary
// available, this function will block until one becomes available or the
// context is canceled.
func (iwh *InWorkspaceHelper) Newuidmap(ctx context.Context, req *UidmapCanaryRequest) error {
	select {
	case iwh.triggerUIDMap <- req:
	case <-ctx.Done():
		return ctx.Err()
	}
	select {
	case err := <-iwh.errchan:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

type iwhserver struct {
	*InWorkspaceHelper
}

func (iwh *iwhserver) UidmapCanary(srv InWorkspaceHelper_UidmapCanaryServer) error {
	atomic.AddInt32(&iwh.canaryAvailable, 1)
	defer atomic.AddInt32(&iwh.canaryAvailable, -1)

	for {
		select {
		case req := <-iwh.triggerUIDMap:
			err := srv.Send(req)
			if err != nil {
				iwh.errchan <- err
			}
			_, err = srv.Recv()

			// we put the error back in, no matter if its nil or not. If it isn't
			// that's the signal that the uidmap was set.
			iwh.errchan <- err
		case <-srv.Context().Done():
			err := srv.Context().Err()
			iwh.errchan <- err
			return err
		}
	}
}
