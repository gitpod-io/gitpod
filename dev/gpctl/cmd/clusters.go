// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"k8s.io/client-go/kubernetes"

	"github.com/gitpod-io/gitpod/gpctl/pkg/util"
	"github.com/gitpod-io/gitpod/ws-manager-bridge/api"
)

// clustersCmd represents the clusters command
var clustersCmd = &cobra.Command{
	Use:   "clusters",
	Short: "Controls and inspects clusters",
	Args:  cobra.ExactArgs(1),
}

func init() {
	clustersCmd.PersistentFlags().StringP("tls", "t", "", "TLS certificate when connecting to a secured gRPC endpoint")
	clustersCmd.PersistentFlags().StringP("port", "p", "8080", "port of the gRPC endpoint")

	rootCmd.AddCommand(clustersCmd)
}

func getClustersClient(ctx context.Context) (*grpc.ClientConn, api.ClusterServiceClient, error) {
	cfg, namespace, err := getKubeconfig()
	if err != nil {
		return nil, nil, err
	}
	clientSet, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, nil, err
	}

	localPort := "30303"
	remotePort, _ := clustersCmd.Flags().GetString("port")
	if remotePort == "" {
		remotePort = "8099"
	}
	port := fmt.Sprintf("%s:%s", localPort, remotePort)
	podName, err := util.FindAnyPodForComponent(clientSet, namespace, "ws-manager-bridge")
	if err != nil {
		return nil, nil, err
	}
	readychan, errchan := util.ForwardPort(ctx, cfg, namespace, podName, port)
	select {
	case <-readychan:
	case err := <-errchan:
		return nil, nil, err
	case <-ctx.Done():
		return nil, nil, ctx.Err()
	}

	secopt := grpc.WithInsecure()
	cert, _ := clustersCmd.Flags().GetString("tls")
	if cert != "" {
		creds, err := credentials.NewClientTLSFromFile(cert, "")
		if err != nil {
			return nil, nil, xerrors.Errorf("could not load tls cert: %w", err)
		}

		secopt = grpc.WithTransportCredentials(creds)
	}

	conn, err := grpc.Dial(fmt.Sprintf("localhost:%s", localPort), secopt)
	if err != nil {
		return nil, nil, err
	}
	return conn, api.NewClusterServiceClient(conn), nil
}
