// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package auth

import (
	"context"
	"fmt"

	"github.com/bufbuild/connect-go"
)

// NewServerInterceptor creates a server-side interceptor which validates that an incoming request contains a Bearer Authorization header
func NewServerInterceptor() connect.UnaryInterceptorFunc {
	interceptor := func(next connect.UnaryFunc) connect.UnaryFunc {
		return connect.UnaryFunc(func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {

			if req.Spec().IsClient {
				return next(ctx, req)
			}

			token, err := tokenFromRequest(ctx, req)
			if err != nil {
				return nil, err
			}

			return next(TokenToContext(ctx, token), req)
		})
	}

	return connect.UnaryInterceptorFunc(interceptor)
}

func tokenFromRequest(ctx context.Context, req connect.AnyRequest) (Token, error) {
	headers := req.Header()

	bearerToken, err := BearerTokenFromHeaders(headers)
	if err == nil {
		return NewAccessToken(bearerToken), nil
	}

	cookie := req.Header().Get("Cookie")
	if cookie != "" {
		return NewCookieToken(cookie), nil
	}

	return Token{}, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No access token or cookie credentials available on request."))
}

// NewClientInterceptor creates a client-side interceptor which injects token as a Bearer Authorization header
func NewClientInterceptor(accessToken string) connect.UnaryInterceptorFunc {
	interceptor := func(next connect.UnaryFunc) connect.UnaryFunc {
		return connect.UnaryFunc(func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {

			if !req.Spec().IsClient {
				return next(ctx, req)
			}

			ctx = TokenToContext(ctx, NewAccessToken(accessToken))

			req.Header().Add(authorizationHeaderKey, bearerPrefix+accessToken)
			return next(ctx, req)
		})
	}

	return connect.UnaryInterceptorFunc(interceptor)
}
