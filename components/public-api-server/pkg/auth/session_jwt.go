// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type SessionClaims struct {
	jwt.RegisteredClaims
}

func NewSessionJWT(subject uuid.UUID, issuer string, issuedAt, expiry time.Time) *jwt.Token {
	return jwt.NewWithClaims(jwt.SigningMethodRS256, &SessionClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Subject:   subject.String(),
			IssuedAt:  jwt.NewNumericDate(issuedAt),
			ExpiresAt: jwt.NewNumericDate(expiry),
		},
	})
}

func VerifySessionJWT(token string, verifier jws.Verifier, expectedIssuer string) (*SessionClaims, error) {
	parsed, err := verifier.Verify(token, &SessionClaims{}, jwt.WithIssuer(expectedIssuer))
	if err != nil {
		return nil, fmt.Errorf("failed to parse jwt: %w", err)
	}

	claims, ok := parsed.Claims.(*SessionClaims)
	if !ok {
		return nil, fmt.Errorf("unknown jwt claims: %w", jwt.ErrTokenInvalidClaims)
	}

	return claims, nil
}

func NewJWTCookieInterceptor(cookieName string, expectedIssuer string, verifier jws.Verifier) connect.UnaryInterceptorFunc {
	interceptor := func(next connect.UnaryFunc) connect.UnaryFunc {

		return connect.UnaryFunc(func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			validJWT := false
			defer func() {
				reportRequestWithJWT(validJWT)
			}()

			if req.Spec().IsClient {
				return next(ctx, req)
			}

			token, err := TokenFromContext(ctx)
			if err != nil {
				return next(ctx, req)
			}

			if token.Type != CookieTokenType {
				return next(ctx, req)
			}

			jwtSessionCookie, err := cookieFromString(token.Value, cookieName)
			if err != nil {
				return next(ctx, req)
			}

			claims, err := VerifySessionJWT(jwtSessionCookie.Value, verifier, expectedIssuer)
			if err != nil {
				log.Extract(ctx).WithError(err).Warnf("Failed to verify JWT session token")
				return next(ctx, req)
			}

			validJWT = claims != nil

			return next(ctx, req)
		})
	}
	return connect.UnaryInterceptorFunc(interceptor)
}

func cookieFromString(rawCookieHeader, name string) (*http.Cookie, error) {
	// To access the cookie as an http.Cookie, we sadly have to construct a request with the appropriate header such
	// that we can then extract the cookie.
	header := http.Header{}
	header.Add("Cookie", rawCookieHeader)
	req := http.Request{Header: header}

	return req.Cookie(name)
}
