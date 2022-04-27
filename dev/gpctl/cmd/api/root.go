// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api

import (
	"context"
	"crypto/tls"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

var (
	connOpts = &connectionOptions{}
)

func NewCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "api",
		Short: "Interact with Public API services",
	}

	cmd.PersistentFlags().StringVar(&connOpts.address, "address", "api.main.preview.gitpod-dev.com:443", "Address of the API endpoint. Must be in the form <host>:<port>.")
	cmd.PersistentFlags().BoolVar(&connOpts.insecure, "insecure", false, "Disable TLS when making requests against the API. For testing purposes only.")

	cmd.PersistentFlags().StringVar(&connOpts.token, "token", "", "Authentication token to interact with the API")

	cmd.AddCommand(newWorkspacesCommand())

	return cmd
}

func newConn(connOpts *connectionOptions) (*grpc.ClientConn, error) {
	log.Log.Infof("Estabilishing gRPC connection against %s", connOpts.address)

	opts := []grpc.DialOption{
		// attach token to requests to auth
		grpc.WithUnaryInterceptor(func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
			withAuth := metadata.AppendToOutgoingContext(ctx, "authorization", connOpts.token)
			return invoker(withAuth, method, req, reply, cc, opts...)
		}),
	}

	if connOpts.insecure {
		opts = append(opts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	} else {
		opts = append(opts, grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{})))
	}

	conn, err := grpc.Dial(connOpts.address, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to dial %s: %w", connOpts.address, err)
	}

	return conn, nil
}

type connectionOptions struct {
	address  string
	insecure bool
	token    string
}

func (o *connectionOptions) Validate() error {
	if o.address == "" {
		return fmt.Errorf("empty connection address")
	}

	if o.token == "" {
		return fmt.Errorf("empty connection token")
	}

	return nil
}
