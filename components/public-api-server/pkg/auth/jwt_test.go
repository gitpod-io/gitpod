// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestJWTSignVerify(t *testing.T) {
	now := time.Now()

	expiry := time.Hour
	sut, err := NewJWT(generateKey(t, "0001"), []Key{generateKey(t, "0002"), generateKey(t, "0003")}, expiry, "jwt-test")
	require.NoError(t, err)

	sut.now = func() time.Time {
		return now
	}

	subject := uuid.New()
	signed, err := sut.Sign(subject)
	require.NoError(t, err)

	claims, _, err := sut.Verify(signed)
	require.NoError(t, err)

	require.Equal(t, &JWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "jwt-test",
			Subject:   subject.String(),
			ExpiresAt: jwt.NewNumericDate(now.Add(expiry)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}, claims)
}

func TestJWTVerifyWithOlderKey(t *testing.T) {
	expiry := time.Hour
	subject := uuid.New()

	key01 := generateKey(t, "0001")
	key02 := generateKey(t, "0002")

	jwtForKey01, err := NewJWT(key01, nil, expiry, "jwt-test")
	require.NoError(t, err)

	signed, err := jwtForKey01.Sign(subject)
	require.NoError(t, err)

	// We use older key as a verifying fallback
	jwtForKey02, err := NewJWT(key02, []Key{key01}, expiry, "jwt-test")
	require.NoError(t, err)

	_, _, err = jwtForKey02.Verify(signed)
	require.NoError(t, err)
}

func generateKey(t *testing.T, id string) Key {
	t.Helper()

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	return Key{
		ID:      id,
		Private: privateKey,
	}
}
