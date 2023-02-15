// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package origin

import (
	"context"

	"github.com/bufbuild/connect-go"
)

func NewInterceptor() *Interceptor {
	return &Interceptor{}
}

type Interceptor struct{}

func (i *Interceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return connect.UnaryFunc(func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		if req.Spec().IsClient {
			req.Header().Add("Origin", FromContext(ctx))
		} else {
			origin := req.Header().Get("Origin")
			ctx = ToContext(ctx, origin)
		}

		return next(ctx, req)
	})
}

func (a *Interceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return func(ctx context.Context, s connect.Spec) connect.StreamingClientConn {
		conn := next(ctx, s)
		conn.RequestHeader().Add("Origin", FromContext(ctx))

		return conn
	}
}

func (a *Interceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		origin := conn.RequestHeader().Get("Origin")
		ctx = ToContext(ctx, origin)

		return next(ctx, conn)
	}
}
