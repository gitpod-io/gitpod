// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package rings

import (
	"context"
	"os"
	"time"

	daemonapi "github.com/gitpod-io/gitpod/ws-daemon/api"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
)

type inWorkspaceServiceClient struct {
	daemonapi.InWorkspaceServiceClient

	conn *grpc.ClientConn
}

func (iwsc *inWorkspaceServiceClient) Close() error {
	if iwsc.conn == nil {
		return nil
	}

	return iwsc.conn.Close()
}

// ConnectToInWorkspaceDaemonService attempts to connect to the InWorkspaceService offered by the ws-daemon.
func ConnectToInWorkspaceDaemonService(ctx context.Context) (*inWorkspaceServiceClient, error) {
	const socketFN = "/.workspace/daemon.sock"

	t := time.NewTicker(500 * time.Millisecond)
	defer t.Stop()
	for {
		if _, err := os.Stat(socketFN); err == nil {
			break
		}

		select {
		case <-t.C:
			continue
		case <-ctx.Done():
			return nil, xerrors.Errorf("socket did not appear before context was canceled")
		}
	}

	conn, err := grpc.DialContext(ctx, "unix://"+socketFN, grpc.WithInsecure())
	if err != nil {
		return nil, err
	}

	return &inWorkspaceServiceClient{
		InWorkspaceServiceClient: daemonapi.NewInWorkspaceServiceClient(conn),
		conn:                     conn,
	}, nil
}
