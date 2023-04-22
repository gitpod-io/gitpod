// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws/jwstest"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestNewSessionJWT(t *testing.T) {
	var (
		subject  = uuid.New()
		issuer   = "some-issuer"
		issuedAt = time.Now()
		expiry   = issuedAt.Add(time.Hour)
	)
	token := NewSessionJWT(subject, issuer, issuedAt, expiry)
	require.Equal(t, &SessionClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Subject:   subject.String(),
			ExpiresAt: jwt.NewNumericDate(expiry),
			IssuedAt:  jwt.NewNumericDate(issuedAt),
		},
	}, token.Claims)
}

func TestVerifySessionJWT(t *testing.T) {
	var (
		subject  = uuid.New()
		issuer   = "some-issuer"
		issuedAt = time.Now()
		expiry   = issuedAt.Add(time.Hour)
	)
	token := NewSessionJWT(subject, issuer, issuedAt, expiry)

	keyset := jwstest.GenerateKeySet(t)
	rsa256, err := jws.NewRSA256(keyset)
	require.NoError(t, err)

	signed, err := rsa256.Sign(token)
	require.NoError(t, err)

	claims, err := VerifySessionJWT(signed, rsa256, issuer)
	require.NoError(t, err)
	require.Equal(t, &SessionClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Subject:   subject.String(),
			ExpiresAt: jwt.NewNumericDate(expiry),
			IssuedAt:  jwt.NewNumericDate(issuedAt),
		},
	}, claims)
}
