// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"context"
	"fmt"
	"net/http"

	"github.com/bufbuild/connect-go"
)

type Interceptor struct {
	accessToken string
	cookieName  string
}

func (a *Interceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return connect.UnaryFunc(func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		if req.Spec().IsClient {
			ctx = TokenToContext(ctx, NewAccessToken(a.accessToken))

			req.Header().Add(authorizationHeaderKey, bearerPrefix+a.accessToken)
			return next(ctx, req)
		}

		token, err := tokenFromHeaders(ctx, req.Header())
		if err != nil {
			return nil, err
		}

		return next(TokenToContext(ctx, token), req)
	})
}

func (a *Interceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return func(ctx context.Context, s connect.Spec) connect.StreamingClientConn {
		ctx = TokenToContext(ctx, NewAccessToken(a.accessToken))
		conn := next(ctx, s)
		conn.RequestHeader().Add(authorizationHeaderKey, bearerPrefix+a.accessToken)
		return conn
	}
}

func (a *Interceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		token, err := tokenFromHeaders(ctx, conn.RequestHeader())
		if err != nil {
			return err
		}
		return next(TokenToContext(ctx, token), conn)
	}
}

// NewServerInterceptor creates a server-side interceptor which validates that an incoming request contains a Bearer Authorization header
func NewServerInterceptor(cookieName string) connect.Interceptor {
	return &Interceptor{}
}

func tokenFromHeaders(ctx context.Context, headers http.Header, cookieName string) (Token, error) {
	bearerToken, err := BearerTokenFromHeaders(headers)
	if err == nil {
		return NewAccessToken(bearerToken), nil
	}

	rawCookie := headers.Get("Cookie")
	if rawCookie != "" {
		// Extract the JWT token header
		cookie, err := cookieFromString(rawCookie, cookieName)
		if err == nil {
			return NewCookieToken(cookie.Value), nil
		}

		// There's no JWT cookie
	}

	return Token{}, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No access token or cookie credentials available on request."))
}

// NewClientInterceptor creates a client-side interceptor which injects token as a Bearer Authorization header
func NewClientInterceptor(accessToken string) connect.Interceptor {
	return &Interceptor{
		accessToken: accessToken,
	}
}
