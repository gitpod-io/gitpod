// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

// clientCmd represents the client command
var clientCmd = &cobra.Command{
	Use:   "client",
	Short: "client that talks to a ws-daemond to initialize workspace",
	Args:  cobra.ExactArgs(1),
}

var clientConfig struct {
	host string
	cert string
}

func init() {
	clientCmd.PersistentFlags().StringVarP(&clientConfig.host, "host", "H", "", "HTTP host to connect to")
	clientCmd.PersistentFlags().StringVarP(&clientConfig.cert, "tls", "t", "", "TLS certificate when connecting to a secured gRPC endpoint")

	rootCmd.AddCommand(clientCmd)
}

func getGRPCConnection() (*grpc.ClientConn, error) {
	secopt := grpc.WithInsecure()
	if clientConfig.cert != "" {
		creds, err := credentials.NewClientTLSFromFile(clientConfig.cert, "")
		if err != nil {
			return nil, xerrors.Errorf("could not load tls cert: %w", err)
		}

		secopt = grpc.WithTransportCredentials(creds)
	}

	conn, err := grpc.Dial(clientConfig.host, secopt)
	if err != nil {
		return nil, err
	}
	return conn, nil
}
