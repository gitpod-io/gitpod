// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"crypto/tls"
	"crypto/x509"
	"io/ioutil"
	"path/filepath"

	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
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
	secopt := grpc.WithTransportCredentials(insecure.NewCredentials())
	if clientConfig.cert != "" {
		fn := clientConfig.cert
		crt, err := ioutil.ReadFile(filepath.Join(fn, "tls.crt"))
		if err != nil {
			return nil, err
		}
		key, err := ioutil.ReadFile(filepath.Join(fn, "tls.key"))
		if err != nil {
			return nil, err
		}
		cert, err := tls.X509KeyPair(crt, key)
		if err != nil {
			return nil, err
		}

		ca, err := ioutil.ReadFile(filepath.Join(fn, "ca.crt"))
		if err != nil {
			return nil, err
		}
		certPool := x509.NewCertPool()
		certPool.AppendCertsFromPEM(ca)

		creds := credentials.NewTLS(&tls.Config{
			Certificates: []tls.Certificate{cert},
			RootCAs:      certPool,
			ServerName:   "ws-manager",
		})

		secopt = grpc.WithTransportCredentials(creds)
	}

	conn, err := grpc.Dial(clientConfig.host, secopt)
	if err != nil {
		return nil, err
	}
	return conn, nil
}
