// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"context"
	"fmt"
	"net/http"

	"github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/components/public-api/go/config"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws"
)

type Interceptor struct {
	accessToken string

	sessionCfg config.SessionConfig
	verifier   jws.Verifier
}

func (i *Interceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return connect.UnaryFunc(func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		if req.Spec().IsClient {
			ctx = TokenToContext(ctx, NewAccessToken(i.accessToken))

			req.Header().Add(authorizationHeaderKey, bearerPrefix+i.accessToken)
			return next(ctx, req)
		}

		token, err := i.tokenFromHeaders(ctx, req.Header())
		if err != nil {
			return nil, err
		}

		return next(TokenToContext(ctx, token), req)
	})
}

func (i *Interceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return func(ctx context.Context, s connect.Spec) connect.StreamingClientConn {
		ctx = TokenToContext(ctx, NewAccessToken(i.accessToken))
		conn := next(ctx, s)
		conn.RequestHeader().Add(authorizationHeaderKey, bearerPrefix+i.accessToken)
		return conn
	}
}

func (i *Interceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		token, err := i.tokenFromHeaders(ctx, conn.RequestHeader())
		if err != nil {
			return err
		}
		return next(TokenToContext(ctx, token), conn)
	}
}

// NewServerInterceptor creates a server-side interceptor which validates that an incoming request contains a valid Authorization header
func NewServerInterceptor(sessionCfg config.SessionConfig, verifier jws.Verifier) connect.Interceptor {
	return &Interceptor{
		sessionCfg: sessionCfg,
		verifier:   verifier,
	}
}

func (i *Interceptor) tokenFromHeaders(ctx context.Context, headers http.Header) (Token, error) {
	bearerToken, err := BearerTokenFromHeaders(headers)
	if err == nil {
		return NewAccessToken(bearerToken), nil
	}

	rawCookie := headers.Get("Cookie")
	if rawCookie == "" {
		return Token{}, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No access token or cookie credentials available on request."))
	}

	// Extract the JWT token from Cookies
	cookies := cookiesFromString(rawCookie, i.sessionCfg.Cookie.Name)
	if len(cookies) == 0 {
		return Token{}, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("No cookie credentials present on request."))
	}

	var cookie *http.Cookie
	for _, c := range cookies {
		_, err := VerifySessionJWT(c.Value, i.verifier, i.sessionCfg.Issuer)
		if err == nil {
			cookie = c
			break
		}
	}
	if cookie == nil {
		return Token{}, connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("JWT session could not be verified."))
	}

	return NewCookieToken(cookie.String()), nil
}

// NewClientInterceptor creates a client-side interceptor which injects token as a Bearer Authorization header
func NewClientInterceptor(accessToken string) connect.Interceptor {
	return &Interceptor{
		accessToken: accessToken,
	}
}

func cookiesFromString(rawCookieHeader, name string) []*http.Cookie {
	// To access the cookie as an http.Cookie, we sadly have to construct a request with the appropriate header such
	// that we can then extract the cookie.
	header := http.Header{}
	header.Add("Cookie", rawCookieHeader)
	req := http.Request{Header: header}

	var cookies []*http.Cookie
	for _, c := range req.Cookies() {
		if c.Name == name {
			cookies = append(cookies, c)
		}
	}
	return cookies
}
