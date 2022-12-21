// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package run

import (
	"context"
	"fmt"
	"sync"

	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/ports"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Option struct {
	Port  uint32
	Ports *ports.Manager
}

type Client struct {
	option *Option

	conn      *grpc.ClientConn
	closeOnce sync.Once

	Status   api.StatusServiceClient
	Terminal api.TerminalServiceClient
}

func New(ctx context.Context, option *Option) (*Client, error) {
	url := fmt.Sprintf("localhost:%d", option.Port)
	conn, err := grpc.DialContext(ctx, url, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	return &Client{
		option:   option,
		conn:     conn,
		Status:   api.NewStatusServiceClient(conn),
		Terminal: api.NewTerminalServiceClient(conn),
	}, nil
}

func (client *Client) Close() {
	client.closeOnce.Do(func() {
		client.conn.Close()
	})
}

func (client *Client) Available() bool {
	if client == nil {
		return false
	}
	return client.option.Ports.IsServed(client.option.Port)
}
