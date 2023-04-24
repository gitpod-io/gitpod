// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"fmt"
	"time"

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
