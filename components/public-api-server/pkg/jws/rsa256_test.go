// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package jws_test

import (
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/jws/jwstest"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"
)

func TestRSA256SignVerify(t *testing.T) {
	keyset := jwstest.GenerateKeySet(t)
	rsa256, err := jws.NewRSA256(keyset)
	require.NoError(t, err)

	claims := &jwt.RegisteredClaims{
		Subject:   "user-id",
		Issuer:    "test-issuer",
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)

	signed, err := rsa256.Sign(token)
	require.NoError(t, err)
	require.Equal(t, keyset.Signing.ID, token.Header[jws.KeyIDName], "signer must add key ID header")

	verified, err := rsa256.Verify(signed, &jwt.RegisteredClaims{})
	require.NoError(t, err)
	require.Equal(t, claims, verified.Claims)
}

func TestRSA256VerifyWithOlderKey(t *testing.T) {
	keyset := jwstest.GenerateKeySet(t)

	// manually sign with older key
	// this simulates a scenario where we issued a token with an older key, which we've since moved into our Validating keys
	validating := keyset.Validating[0]
	claims := &jwt.RegisteredClaims{
		Subject:   "user-id",
		Issuer:    "test-issuer",
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header[jws.KeyIDName] = validating.ID

	signed, err := token.SignedString(validating.Private)
	require.NoError(t, err)

	// use our "newer" setup with a new signing key
	rsa256, err := jws.NewRSA256(keyset)
	require.NoError(t, err)

	verified, err := rsa256.Verify(signed, &jwt.RegisteredClaims{})
	require.NoError(t, err)
	require.Equal(t, claims, verified.Claims)
}
