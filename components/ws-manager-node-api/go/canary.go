// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api

import (
	context "context"
	"sync/atomic"

	grpc "google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// NewInWorkspaceHelper produces a new InWorkspaceHelper
func NewInWorkspaceHelper() *InWorkspaceHelper {
	return &InWorkspaceHelper{
		triggerUIDMap: make(chan *triggerNewuidmapReq),
	}
}

type triggerNewuidmapReq struct {
	Req  *UidmapCanaryRequest
	Resp chan error
}

// InWorkspaceHelper implements InWorkspaceHelperServer
type InWorkspaceHelper struct {
	canaryAvailable int32

	triggerUIDMap chan *triggerNewuidmapReq
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
	trigger := &triggerNewuidmapReq{
		Req:  req,
		Resp: make(chan error, 1),
	}

	select {
	case iwh.triggerUIDMap <- trigger:
	case <-ctx.Done():
		return ctx.Err()
	}

	select {
	case err := <-trigger.Resp:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

type iwhserver struct {
	*InWorkspaceHelper
}

func (iwh *iwhserver) RegisterGRPC(srv *grpc.Server) {
	RegisterInWorkspaceHelperServer(srv, iwh)
}

func (iwh *iwhserver) UidmapCanary(srv InWorkspaceHelper_UidmapCanaryServer) error {
	atomic.AddInt32(&iwh.canaryAvailable, 1)
	defer atomic.AddInt32(&iwh.canaryAvailable, -1)

	for {
		select {
		case req := <-iwh.triggerUIDMap:
			err := srv.Send(req.Req)
			if err != nil {
				req.Resp <- err
			}
			resp, err := srv.Recv()
			if err != nil {
				req.Resp <- err
			}
			if resp.ErrorCode > 0 {
				req.Resp <- status.Error(codes.Code(resp.ErrorCode), resp.Message)
			}

			req.Resp <- nil
		case <-srv.Context().Done():
			// canary dropped out - we're done here
		}
	}
}
