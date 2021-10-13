// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"crypto/tls"

	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"k8s.io/client-go/kubernetes"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/gpctl/pkg/util"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
)

// workspacesDisposeContentCmd represents the dispose-content command
var workspacesDisposeContentCmd = &cobra.Command{
	Use:   "dispose-content <workspaceID>",
	Short: "calls dispose-content for a workspace on ws-daemon. Assumes the ws-daemon is listening on localhost:8080",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		cfg, namespace, err := getKubeconfig()
		if err != nil {
			return err
		}
		clientSet, err := kubernetes.NewForConfig(cfg)
		if err != nil {
			return err
		}

		certPool, err := util.CertPoolFromSecret(clientSet, namespace, "ws-daemon-tls", []string{"ca.crt"})
		if err != nil {
			return xerrors.Errorf("could not load ca cert: %w", err)
		}
		cert, err := util.CertFromSecret(clientSet, namespace, "ws-daemon-tls", "tls.crt", "tls.key")
		if err != nil {
			return xerrors.Errorf("could not load tls cert: %w", err)
		}
		creds := credentials.NewTLS(&tls.Config{
			Certificates: []tls.Certificate{cert},
			RootCAs:      certPool,
			ServerName:   "wsdaemon",
		})

		conn, err := grpc.Dial("localhost:8080", grpc.WithTransportCredentials(creds))
		if err != nil {
			return err
		}
		defer conn.Close()
		client := api.NewWorkspaceContentServiceClient(conn)

		instanceID := args[0]
		resp, err := client.DisposeWorkspace(ctx, &api.DisposeWorkspaceRequest{
			Id:     instanceID,
			Backup: true,
		})
		if err != nil {
			log.Fatal(err)
		}

		log.WithField("instanceId", instanceID).WithField("resp", resp).Info("DisposeWorkspace done")
		return nil
	},
}

func init() {
	workspacesCmd.AddCommand(workspacesDisposeContentCmd)
}
