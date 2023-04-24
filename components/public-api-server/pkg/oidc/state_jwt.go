// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type StateClaims struct {
	// Internal client ID
	ClientConfigID string `json:"clientId"`
	ReturnToURL    string `json:"returnTo"`

	jwt.RegisteredClaims
}

func NewStateJWT(clientConfigID string, returnURL string, issuedAt, expiry time.Time) *jwt.Token {
	return jwt.NewWithClaims(jwt.SigningMethodHS256, &StateClaims{
		ClientConfigID: clientConfigID,
		ReturnToURL:    returnURL,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiry),
			IssuedAt:  jwt.NewNumericDate(issuedAt),
		},
	})
}
