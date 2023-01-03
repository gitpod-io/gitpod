// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"context"
	"net"
	"time"

	"google.golang.org/grpc"
)

func grpcDialerWithInitialDelay(delay time.Duration) grpc.DialOption {
	return grpc.WithContextDialer(func(_ context.Context, addr string) (net.Conn, error) {
		<-time.After(delay)

		conn, err := net.Dial("tcp", addr)
		if err != nil {
			return nil, err
		}
		return conn, nil
	})
}
