// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package jws

import (
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

func NewHS256FromKeySet(keyset KeySet) *HS256 {
	// We treat the signing private key as our symmetric key, to do that, we first have to convert it to bytes
	// For bytes conversion, we encode it as PKCS1 PK, pem format
	raw := x509.MarshalPKCS1PrivateKey(keyset.Signing.Private)
	key := pem.EncodeToMemory(&pem.Block{
		Type:  "",
		Bytes: raw,
	})

	return NewHS256(key)
}

func NewHS256(symmetricKey []byte) *HS256 {
	return &HS256{
		key: symmetricKey,
	}
}

type HS256 struct {
	key []byte
}

func (s *HS256) Sign(token *jwt.Token) (string, error) {
	if token.Method != jwt.SigningMethodHS256 {
		return "", errors.New("invalid signing method, token must use HS256")
	}

	signed, err := token.SignedString(s.key)
	if err != nil {
		return "", fmt.Errorf("failed to sign jwt: %w", err)
	}

	return signed, nil
}

func (v *HS256) Verify(token string, claims jwt.Claims, opts ...jwt.ParserOption) (*jwt.Token, error) {
	parsed, err := jwt.ParseWithClaims(token, claims, jwt.Keyfunc(func(t *jwt.Token) (interface{}, error) {
		return v.key, nil
	}), opts...)

	if err != nil {
		return nil, fmt.Errorf("failed to parse jwt: %w", err)
	}

	return parsed, nil
}
