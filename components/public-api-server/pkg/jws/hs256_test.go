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

func TestHS256SignVerify(t *testing.T) {
	keyset := jwstest.GenerateKeySet(t)
	hs256 := jws.NewHS256FromKeySet(keyset)

	claims := &jwt.RegisteredClaims{
		Subject:   "user-id",
		Issuer:    "test-issuer",
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	signed, err := hs256.Sign(token)
	require.NoError(t, err)

	verified, err := hs256.Verify(signed, &jwt.RegisteredClaims{})
	require.NoError(t, err)
	require.Equal(t, claims, verified.Claims)
}
