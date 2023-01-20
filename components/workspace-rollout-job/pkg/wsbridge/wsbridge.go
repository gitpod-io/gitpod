// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsbridge

import (
	"context"
	"fmt"

	logrus "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/gpctl/pkg/util"
	"github.com/gitpod-io/gitpod/ws-manager-bridge/api"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
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
	connection *grpc.ClientConn
}

func NewWsManagerBridgeClient(ctx context.Context, kubeConfig *rest.Config, localPort int) (*WsManagerBridgeClient, error) {
	clientSet, err := kubernetes.NewForConfig(kubeConfig)
	if err != nil {
		return nil, err
	}

	// 8080 is the port of the `ws-manager-bridge` grpc service
	port := fmt.Sprintf("%d:%d", localPort, 8080)
	podName, err := util.FindAnyPodForComponent(clientSet, "default", "ws-manager-bridge")
	if err != nil {
		return nil, err
	}
	readychan, errchan := util.ForwardPort(ctx, kubeConfig, "default", podName, port)
	select {
	case <-readychan:
	case err := <-errchan:
		return nil, err
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	secopt := grpc.WithTransportCredentials(insecure.NewCredentials())
	conn, err := grpc.Dial(fmt.Sprintf("localhost:%d", localPort), secopt, util.WithClientUnaryInterceptor())
	if err != nil {
		return nil, err
	}

	return &WsManagerBridgeClient{
		connection: conn,
	}, nil
}

// Checks if the given cluster has the expected score
func (c *WsManagerBridgeClient) GetScore(ctx context.Context, clusterName string) (int32, error) {
	client, err := c.getClustersClient(ctx)
	if err != nil {
		return 0, err
	}

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
	client, err := c.getClustersClient(ctx)
	if err != nil {
		return err
	}

	if _, err := client.Update(ctx, &api.UpdateRequest{
		Name: clusterName,
		Property: &api.UpdateRequest_Score{
			Score: score,
		},
	}); err != nil {
		return err
	}

	log.Infof("Updated score as %s:%d", clusterName, score)
	return nil
}

func (c *WsManagerBridgeClient) getClustersClient(ctx context.Context) (api.ClusterServiceClient, error) {
	if c.connection == nil {
		return nil, fmt.Errorf("No Connection Created yet")
	}
	return api.NewClusterServiceClient(c.connection), nil
}
