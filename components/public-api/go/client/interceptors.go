// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package client

import (
	"context"
	"fmt"
	"github.com/bufbuild/connect-go"
)

func AuthorizationInterceptor(token string) connect.Interceptor {
	interceptor := connect.UnaryInterceptorFunc(func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			if req.Spec().IsClient {
				// Send a token with client requests.
				req.Header().Set("Authorization", fmt.Sprintf("Bearer %s", token))
			}

			return next(ctx, req)
		}
	})

	return interceptor
}
