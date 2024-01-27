// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type StateClaims struct {
	StateParams StateParams `json:"stateParams"`
	jwt.RegisteredClaims
}

func NewStateJWT(stateParams StateParams, issuedAt, expiry time.Time) *jwt.Token {
	return jwt.NewWithClaims(jwt.SigningMethodHS256, &StateClaims{
		StateParams: stateParams,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiry),
			IssuedAt:  jwt.NewNumericDate(issuedAt),
		},
	})
}
