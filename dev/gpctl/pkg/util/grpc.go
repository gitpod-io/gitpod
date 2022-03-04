// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package util

import (
	"context"
	"os"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

const clientNameKey = "client-name"

// create unique client names. Concatenate both HOST and HOSTNAME so that we can track the executions
// from both linux and macos
var clientName = "gpctl:" + os.Getenv("USER") + "@" + os.Getenv("HOSTNAME") + os.Getenv("HOST")

func clientInterceptor(
	ctx context.Context,
	method string,
	req interface{},
	reply interface{},
	cc *grpc.ClientConn,
	invoker grpc.UnaryInvoker,
	opts ...grpc.CallOption,
) error {
	ctx = metadata.AppendToOutgoingContext(ctx, clientNameKey, clientName)
	err := invoker(ctx, method, req, reply, cc, opts...)
	return err
}

func WithClientUnaryInterceptor() grpc.DialOption {
	return grpc.WithUnaryInterceptor(clientInterceptor)
}
