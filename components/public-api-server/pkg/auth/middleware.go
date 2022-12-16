// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"context"
	"fmt"

	"github.com/bufbuild/connect-go"
)

type AuthInterceptor struct {
	accessToken string
}

func (a *AuthInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return connect.UnaryFunc(func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		if req.Spec().IsClient {
			ctx = TokenToContext(ctx, NewAccessToken(a.accessToken))

			req.Header().Add(authorizationHeaderKey, bearerPrefix+a.accessToken)
			return next(ctx, req)
		}

		token, err := tokenFromRequest(ctx, req)
		if err != nil {
			return nil, err
		}

		return next(TokenToContext(ctx, token), req)
	})
}

func (a *AuthInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return func(ctx context.Context, s connect.Spec) connect.StreamingClientConn {
		ctx = TokenToContext(ctx, NewAccessToken(a.accessToken))
		conn := next(ctx, s)
		conn.RequestHeader().Add(authorizationHeaderKey, bearerPrefix+a.accessToken)
		return conn
	}
}

func (a *AuthInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		token, err := tokenFromConn(ctx, conn)
		if err != nil {
			return err
		}
		return next(TokenToContext(ctx, token), conn)
	}
}

// NewServerInterceptor creates a server-side interceptor which validates that an incoming request contains a Bearer Authorization header
func NewServerInterceptor() connect.Interceptor {
	return &AuthInterceptor{}
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

func tokenFromConn(ctx context.Context, conn connect.StreamingHandlerConn) (Token, error) {
	headers := conn.RequestHeader()

	bearerToken, err := BearerTokenFromHeaders(headers)
	if err == nil {
		return NewAccessToken(bearerToken), nil
	}

	cookie := conn.RequestHeader().Get("Cookie")
	if cookie != "" {
		return NewCookieToken(cookie), nil
	}

	return Token{}, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No access token or cookie credentials available on request."))
}

// NewClientInterceptor creates a client-side interceptor which injects token as a Bearer Authorization header
func NewClientInterceptor(accessToken string) connect.Interceptor {
	return &AuthInterceptor{
		accessToken: accessToken,
	}
}
