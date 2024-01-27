// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package jws

import (
	"crypto"
	"crypto/rsa"
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

func NewRSA256(keyset KeySet) (*RSA256, error) {
	verifier, err := NewRSA256VerifierFromKeySet(keyset)
	if err != nil {
		return nil, err
	}

	return &RSA256{
		RSA256Signer: &RSA256Signer{
			Signing: keyset.Signing,
		},
		RSA256Verifier: verifier,
	}, nil
}

type RSA256 struct {
	*RSA256Signer
	*RSA256Verifier
}

type RSA256Signer struct {
	Signing Key
}

func (s *RSA256Signer) Sign(token *jwt.Token) (string, error) {
	if token.Method != jwt.SigningMethodRS256 {
		return "", errors.New("invalid signing method, token must use RSA256")
	}

	token.Header[KeyIDName] = s.Signing.ID

	signed, err := token.SignedString(s.Signing.Private)
	if err != nil {
		return "", fmt.Errorf("failed to sign jwt: %w", err)
	}

	return signed, nil
}

func NewRSA256VerifierFromKeySet(keyset KeySet) (*RSA256Verifier, error) {
	keys := map[string]*rsa.PrivateKey{
		keyset.Signing.ID: keyset.Signing.Private,
	}

	for _, v := range keyset.Validating {
		if _, found := keys[v.ID]; found {
			return nil, errors.New("duplicate keys when constructing JWT")
		}

		keys[v.ID] = v.Private
	}

	return &RSA256Verifier{
		Keys: keys,
	}, nil
}

type RSA256Verifier struct {
	// Keys by Key ID
	Keys map[string]*rsa.PrivateKey
}

func (v *RSA256Verifier) Verify(token string, claims jwt.Claims, opts ...jwt.ParserOption) (*jwt.Token, error) {
	parsed, err := jwt.ParseWithClaims(token, claims, jwt.Keyfunc(func(t *jwt.Token) (interface{}, error) {
		return v.getPublicKeyFromKeyID(t)
	}), opts...)

	if err != nil {
		return nil, fmt.Errorf("failed to parse jwt: %w", err)
	}

	return parsed, nil
}

func (v *RSA256Verifier) getPublicKeyFromKeyID(token *jwt.Token) (crypto.PublicKey, error) {
	keyID, ok := token.Header[KeyIDName].(string)
	if !ok {
		return nil, fmt.Errorf("missing key id: %w", ErrInvalidKeyID)
	}

	key, ok := v.Keys[keyID]
	if !ok {
		return nil, fmt.Errorf("unknown key id %s: %w", keyID, ErrInvalidKeyID)
	}

	return key.Public(), nil
}
