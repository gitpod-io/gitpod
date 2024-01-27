// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"
)

func TestNewStateJWT(t *testing.T) {
	var (
		clientConfigID = "test-id"
		returnURL      = "test-url"
		issuedAt       = time.Now()
		expiry         = issuedAt.Add(5 * time.Minute)
	)
	token := NewStateJWT(StateParams{
		ClientConfigID: clientConfigID,
		ReturnToURL:    returnURL,
	}, issuedAt, expiry)
	require.Equal(t, jwt.SigningMethodHS256, token.Method)
	require.Equal(t, &StateClaims{
		StateParams: StateParams{
			ClientConfigID: clientConfigID,
			ReturnToURL:    returnURL,
		},
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiry),
			IssuedAt:  jwt.NewNumericDate(issuedAt),
		},
	}, token.Claims)
}
