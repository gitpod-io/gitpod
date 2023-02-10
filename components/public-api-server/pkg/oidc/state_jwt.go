// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"time"

	"github.com/golang-jwt/jwt/v4"
)

type StateJWT struct {
	key       []byte
	expiresIn time.Duration
}

func NewStateJWT(key []byte) *StateJWT {
	return &StateJWT{
		key:       key,
		expiresIn: 5 * time.Minute,
	}
}

func newTestStateJWT(key []byte, expiresIn time.Duration) *StateJWT {
	thing := NewStateJWT(key)
	thing.expiresIn = expiresIn
	return thing
}

type StateClaims struct {
	// Internal client ID
	ClientConfigID string `json:"clientId"`
	ReturnToURL    string `json:"returnTo"`

	jwt.RegisteredClaims
}

func (s *StateJWT) Encode(claims StateClaims) (string, error) {

	expirationTime := time.Now().Add(s.expiresIn)
	claims.ExpiresAt = jwt.NewNumericDate(expirationTime)

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	encodedToken, err := token.SignedString(s.key)

	return encodedToken, err
}

func (s *StateJWT) Decode(tokenString string) (*StateClaims, error) {
	claims := &StateClaims{}
	_, err := jwt.ParseWithClaims(
		tokenString,
		claims,
		func(token *jwt.Token) (interface{}, error) {
			return []byte(s.key), nil
		},
	)

	return claims, err
}
