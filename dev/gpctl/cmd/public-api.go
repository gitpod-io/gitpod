// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"crypto/tls"
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

var publicApiCmd = &cobra.Command{
	Use:   "api",
	Short: "Interact with Public API services",
}

var publicApiCmdOpts struct {
	address  string
	insecure bool
	token    string
}

func init() {
	rootCmd.AddCommand(publicApiCmd)

	publicApiCmd.PersistentFlags().StringVar(&publicApiCmdOpts.address, "address", "api.main.preview.gitpod-dev.com:443", "Address of the API endpoint. Must be in the form <host>:<port>.")
	publicApiCmd.PersistentFlags().BoolVar(&publicApiCmdOpts.insecure, "insecure", false, "Disable TLS when making requests against the API. For testing purposes only.")
	publicApiCmd.PersistentFlags().StringVar(&publicApiCmdOpts.token, "token", os.Getenv("GPCTL_PUBLICAPI_TOKEN"), "Authentication token to interact with the API")
}

func newPublicAPIConn() (*grpc.ClientConn, error) {
	if publicApiCmdOpts.address == "" {
		return nil, fmt.Errorf("empty connection address")
	}

	if publicApiCmdOpts.token == "" {
		return nil, fmt.Errorf("empty connection token. Use --token or GPCTL_PUBLICAPI_TOKEN to provide one.")
	}

	log.Debugf("Establishing gRPC connection against %s", publicApiCmdOpts.address)

	opts := []grpc.DialOption{
		// attach token to requests to auth
		grpc.WithUnaryInterceptor(func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
			withAuth := metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+publicApiCmdOpts.token)
			return invoker(withAuth, method, req, reply, cc, opts...)
		}),
	}

	if publicApiCmdOpts.insecure {
		opts = append(opts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	} else {
		opts = append(opts, grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{})))
	}

	conn, err := grpc.Dial(publicApiCmdOpts.address, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to dial %s: %w", publicApiCmdOpts.address, err)
	}

	return conn, nil
}
