// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsbridge

import (
	"context"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/gitpod-io/gitpod/ws-manager-bridge/api"
)

func GetClustersClient(ctx context.Context) (*grpc.ClientConn, api.ClusterServiceClient, error) {
	secopt := grpc.WithTransportCredentials(insecure.NewCredentials())

	// TODO: Talk directly to the ws-manager-bridge service
	conn, err := grpc.Dial("localhost:8080", secopt)
	if err != nil {
		return nil, nil, err
	}
	return conn, api.NewClusterServiceClient(conn), nil
}

// Checks if the given cluster has the expected score
func CheckScore(clusterName string, score int32) error {
	ctx := context.Background()
	conn, client, err := GetClustersClient(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	clusters, err := client.List(ctx, &api.ListRequest{})
	if err != nil {
		return err
	}

	for _, cluster := range clusters.Status {
		if cluster.Name == clusterName {
			if cluster.Score == score {
				return nil
			} else {
				return fmt.Errorf("cluster %s has score %d, expected %d", clusterName, cluster.Score, score)
			}
		}
	}
	return fmt.Errorf("expected cluster %s to be present", clusterName)

}

// UpdateScore updates the score on a given cluster
// while sending relevant alerts
func UpdateScore(clusterName string, score int32) error {
	ctx := context.Background()
	conn, client, err := GetClustersClient(ctx)
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

	return nil
}
