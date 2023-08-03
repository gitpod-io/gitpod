// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"

	connect "github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
)

func NewIDEClientService(pool proxy.ServerConnectionPool) *IDEClientService {
	return &IDEClientService{
		connectionPool: pool,
	}
}

var _ v1connect.IDEClientServiceHandler = (*IDEClientService)(nil)

type IDEClientService struct {
	connectionPool proxy.ServerConnectionPool

	v1connect.UnimplementedIDEClientServiceHandler
}

func (this *IDEClientService) SendHeartbeat(ctx context.Context, req *connect.Request[v1.SendHeartbeatRequest]) (*connect.Response[v1.SendHeartbeatResponse], error) {
	conn, err := getConnection(ctx, this.connectionPool)
	if err != nil {
		return nil, err
	}

	workspace, err := conn.GetWorkspace(ctx, req.Msg.GetWorkspaceId())
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to get workspace.")
		return nil, proxy.ConvertError(err)
	}

	if workspace.LatestInstance == nil {
		log.Extract(ctx).WithError(err).Error("Failed to get latest instance.")
		return nil, connect.NewError(connect.CodeFailedPrecondition, fmt.Errorf("instance not found"))
	}

	err = conn.SendHeartBeat(ctx, &protocol.SendHeartBeatOptions{
		InstanceID: workspace.LatestInstance.ID,
		WasClosed:  false,
	})
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	return connect.NewResponse(&v1.SendHeartbeatResponse{}), nil
}

func (this *IDEClientService) SendDidClose(ctx context.Context, req *connect.Request[v1.SendDidCloseRequest]) (*connect.Response[v1.SendDidCloseResponse], error) {
	conn, err := getConnection(ctx, this.connectionPool)
	if err != nil {
		return nil, err
	}

	workspace, err := conn.GetWorkspace(ctx, req.Msg.GetWorkspaceId())
	if err != nil {
		log.Extract(ctx).WithError(err).Error("Failed to get workspace.")
		return nil, proxy.ConvertError(err)
	}

	if workspace.LatestInstance == nil {
		log.Extract(ctx).WithError(err).Error("Failed to get latest instance.")
		return nil, connect.NewError(connect.CodeFailedPrecondition, fmt.Errorf("instance not found"))
	}

	err = conn.SendHeartBeat(ctx, &protocol.SendHeartBeatOptions{
		InstanceID: workspace.LatestInstance.ID,
		WasClosed:  true,
	})
	if err != nil {
		return nil, proxy.ConvertError(err)
	}

	return connect.NewResponse(&v1.SendDidCloseResponse{}), nil
}

func (s *IDEClientService) UpdateGitStatus(ctx context.Context, req *connect.Request[v1.UpdateGitStatusRequest]) (*connect.Response[v1.UpdateGitStatusResponse], error) {
	workspaceID, err := validateWorkspaceID(ctx, req.Msg.GetWorkspaceId())
	if err != nil {
		return nil, err
	}

	conn, err := getConnection(ctx, s.connectionPool)
	if err != nil {
		return nil, err
	}

	var status *protocol.WorkspaceInstanceRepoStatus
	if req.Msg.GetStatus() != nil {
		status = &protocol.WorkspaceInstanceRepoStatus{
			Branch:               req.Msg.GetStatus().GetBranch(),
			LatestCommit:         req.Msg.GetStatus().GetLatestCommit(),
			TotalUncommitedFiles: float64(req.Msg.GetStatus().GetTotalUncommitedFiles()),
			TotalUntrackedFiles:  float64(req.Msg.GetStatus().GetTotalUntrackedFiles()),
			TotalUnpushedCommits: float64(req.Msg.GetStatus().GetTotalUnpushedCommits()),
			UncommitedFiles:      req.Msg.GetStatus().GetUncommitedFiles(),
			UntrackedFiles:       req.Msg.GetStatus().GetUntrackedFiles(),
			UnpushedCommits:      req.Msg.GetStatus().GetUnpushedCommits(),
		}
	}

	err = conn.UpdateGitStatus(ctx, workspaceID, status)
	if err != nil {
		log.Extract(ctx).Error("Failed to update repo status")
		return nil, proxy.ConvertError(err)
	}

	return connect.NewResponse(
		&v1.UpdateGitStatusResponse{},
	), nil
}
