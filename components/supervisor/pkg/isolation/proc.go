// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package isolation

import (
	"context"
	"path/filepath"

	"github.com/gitpod-io/gitpod/supervisor/api"
	daemonapi "github.com/gitpod-io/gitpod/ws-daemon/api"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Ring1IsolationService offers isolation services towards children of ring1
type Ring1IsolationService struct {
	Client daemonapi.InWorkspaceServiceClient

	RootfsLocation string
}

// MountProc mounts proc below ring1
func (s *Ring1IsolationService) MountProc(ctx context.Context, req *api.MountProcRequest) (*api.MountProcResponse, error) {
	pth := req.Target

	if !filepath.IsAbs(pth) {
		// we require an absolute path to avoid clients from mounting proc outside of the ring2 rootfs,
		// possibly creating unintended side-effects.
		return nil, status.Errorf(codes.InvalidArgument, "target must be absolute")
	}

	// Ensure that all paths are cleaned (especially problematic ones like
	// "/../../../../../" which can cause lots of issues).
	pth = filepath.Clean(pth)

	_, err := s.Client.MountProc(ctx, &daemonapi.MountProcRequest{
		Target: filepath.Join(s.RootfsLocation, pth),
		Pid:    req.Pid,
	})
	if err != nil {
		return nil, err
	}

	return &api.MountProcResponse{}, nil
}
