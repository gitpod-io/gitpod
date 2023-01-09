// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"sync"
	"time"

	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/supervisor/api"
)

type SupervisorClient struct {
	conn      *grpc.ClientConn
	closeOnce sync.Once

	Status   api.StatusServiceClient
	Terminal api.TerminalServiceClient
	Info     api.InfoServiceClient
}

type SupervisorClientOption struct {
	Address string
}

func New(ctx context.Context, options ...*SupervisorClientOption) (*SupervisorClient, error) {
	address := util.GetSupervisorAddress()
	for _, option := range options {
		if option.Address != "" {
			address = option.Address
		}
	}
	conn, err := grpc.DialContext(ctx, address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, xerrors.Errorf("failed connecting to supervisor: %w", err)
	}

	return &SupervisorClient{
		conn:     conn,
		Status:   api.NewStatusServiceClient(conn),
		Terminal: api.NewTerminalServiceClient(conn),
		Info:     api.NewInfoServiceClient(conn),
	}, nil
}

func (client *SupervisorClient) Close() {
	client.closeOnce.Do(func() {
		client.conn.Close()
	})
}

func (client *SupervisorClient) WaitForIDEReady(ctx context.Context) {
	var ideReady bool
	for !ideReady {
		resp, _ := client.Status.IDEStatus(ctx, &api.IDEStatusRequest{Wait: true})
		if resp != nil {
			ideReady = resp.Ok
		}
		if ctx.Err() != nil {
			return
		}
		if !ideReady {
			time.Sleep(1 * time.Second)
		}
	}
}
