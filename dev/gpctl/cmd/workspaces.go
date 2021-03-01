// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"strings"

	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"k8s.io/client-go/kubernetes"

	"github.com/gitpod-io/gitpod/gpctl/pkg/util"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

// workspacesCmd represents the client command
var workspacesCmd = &cobra.Command{
	Use:   "workspaces",
	Short: "Controls and inspects workspaces in the Gitpod installation",
	Args:  cobra.ExactArgs(1),
}

func init() {
	workspacesCmd.PersistentFlags().StringP("tls", "t", "", "TLS certificate when connecting to a secured gRPC endpoint")

	rootCmd.AddCommand(workspacesCmd)
}

func getWorkspacesClient(ctx context.Context) (*grpc.ClientConn, api.WorkspaceManagerClient, error) {
	cfg, namespace, err := getKubeconfig()
	if err != nil {
		return nil, nil, err
	}
	clientSet, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, nil, err
	}

	port := "20202:8080"
	podName, err := util.FindAnyPodForComponent(clientSet, namespace, "ws-manager")
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
	cert, _ := workspacesCmd.Flags().GetString("tls")
	if cert != "" {
		creds, err := credentials.NewClientTLSFromFile(cert, "")
		if err != nil {
			return nil, nil, xerrors.Errorf("could not load tls cert: %w", err)
		}

		secopt = grpc.WithTransportCredentials(creds)
	}
	conn, err := grpc.Dial("localhost:20202", secopt)
	if err != nil {
		return nil, nil, err
	}
	return conn, api.NewWorkspaceManagerClient(conn), nil
}

func getStatusByURL(ctx context.Context, client api.WorkspaceManagerClient, url string) (*api.WorkspaceStatus, error) {
	wsresp, err := client.GetWorkspaces(ctx, &api.GetWorkspacesRequest{})
	if err != nil {
		return nil, err
	}

	for _, ws := range wsresp.GetStatus() {
		if ws.Spec.Url == url || strings.TrimPrefix(ws.Spec.Url, "https://") == url || strings.TrimPrefix(ws.Spec.Url, "http://") == url {
			return ws, nil
		}
	}

	return nil, xerrors.Errorf("no workspace with URL \"%s\" found", url)
}
