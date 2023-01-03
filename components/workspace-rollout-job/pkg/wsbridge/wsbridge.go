// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsbridge

import (
	"context"
	"fmt"

	logrus "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager-bridge/api"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

var (
	log = logrus.WithField("component", "ws-manager-bridge-client")
)

// RolloutAction is the interface that wraps the updateScore method.
type RolloutAction interface {
	UpdateScore(ctx context.Context, clusterName string, score int32) error
	GetScore(ctx context.Context, clusterName string) (int32, error)
}

type WsManagerBridgeClient struct {
	wsManagerBridgeURL string
}

func NewWsManagerBridgeClient(wsManagerBridgeURL string) *WsManagerBridgeClient {
	return &WsManagerBridgeClient{
		wsManagerBridgeURL: wsManagerBridgeURL,
	}
}

// Checks if the given cluster has the expected score
func (c *WsManagerBridgeClient) GetScore(ctx context.Context, clusterName string) (int32, error) {

	conn, client, err := c.getClustersClient(ctx)
	if err != nil {
		return 0, err
	}
	defer conn.Close()

	clusters, err := client.List(ctx, &api.ListRequest{})
	if err != nil {
		return 0, err
	}

	for _, cluster := range clusters.Status {
		if cluster.Name == clusterName {
			return cluster.Score, nil
		}
	}
	return 0, fmt.Errorf("expected cluster %s to be present", clusterName)

}

// UpdateScore updates the score on a given cluster
// while sending relevant alerts
func (c *WsManagerBridgeClient) UpdateScore(ctx context.Context, clusterName string, score int32) error {
	conn, client, err := c.getClustersClient(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	client.Update(ctx, &api.UpdateRequest{
		Name: clusterName,
		Property: &api.UpdateRequest_Score{
			Score: score,
		},
	})
	log.Infof("Updated score as %s:%d", clusterName, score)
	return nil
}

func (c *WsManagerBridgeClient) getClustersClient(ctx context.Context) (*grpc.ClientConn, api.ClusterServiceClient, error) {
	secopt := grpc.WithTransportCredentials(insecure.NewCredentials())

	conn, err := grpc.Dial(c.wsManagerBridgeURL, secopt)
	if err != nil {
		return nil, nil, err
	}
	return conn, api.NewClusterServiceClient(conn), nil
}
