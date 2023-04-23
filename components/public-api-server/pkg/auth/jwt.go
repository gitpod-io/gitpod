// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"time"

	"github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/components/public-api/go/config"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const KeyIDName = "kid"

var (
	ErrInvalidKeyID = errors.New("token has invalid key id")
)

type JWTSigner interface {
	Sign(subject uuid.UUID) (string, error)
}

type JWTVerifier interface {
	Verify(token string) (*JWTClaims, *jwt.Token, error)
}

type Key struct {
	ID      string
	Private *rsa.PrivateKey
	// We don't need PublicKey because we can derive the public key from the private key
}

type JWTClaims struct {
	jwt.RegisteredClaims
}

func NewJWTFromAuthPKI(pki config.AuthPKIConfiguration, expiry time.Duration, issuer string) (*JWT, error) {
	signing, err := readKeyPair(pki.Signing)
	if err != nil {
		return nil, fmt.Errorf("failed to read signing key: %w", err)
	}

	var validating []Key
	for _, keypair := range pki.Validating {
		key, err := readKeyPair(keypair)
		if err != nil {
			return nil, fmt.Errorf("failed to read validating key: %w", err)
		}

		validating = append(validating, key)
	}

	return NewJWT(signing, validating, expiry, issuer)
}

func NewJWT(signing Key, validating []Key, expiry time.Duration, issuer string) (*JWT, error) {
	keys := map[string]*rsa.PrivateKey{
		signing.ID: signing.Private,
	}

	for _, v := range validating {
		if _, found := keys[v.ID]; found {
			return nil, errors.New("duplicate keys when constructing JWT")
		}

		keys[v.ID] = v.Private
	}

	return &JWT{
		Signing:    signing,
		Validating: keys,
		Expiry:     expiry,
		Issuer:     issuer,

		now: func() time.Time {
			return time.Now().UTC()
		},
	}, nil
}

type JWT struct {
	Validating map[string]*rsa.PrivateKey
	Signing    Key

	Expiry time.Duration
	Issuer string
	now    func() time.Time
}

func (j *JWT) Sign(subject uuid.UUID) (string, error) {
	now := j.now()
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, JWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    j.Issuer,
			Subject:   subject.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(j.Expiry)),
		},
	})
	token.Header[KeyIDName] = j.Signing.ID

	signed, err := token.SignedString(j.Signing.Private)
	if err != nil {
		return "", fmt.Errorf("failed to sign jwt: %w", err)
	}

	return signed, nil
}

func (j *JWT) Verify(token string) (*JWTClaims, *jwt.Token, error) {
	parsed, err := jwt.ParseWithClaims(token, &JWTClaims{}, jwt.Keyfunc(func(t *jwt.Token) (interface{}, error) {
		keyID, ok := t.Header[KeyIDName].(string)
		if !ok {
			return nil, fmt.Errorf("missing key id: %w", ErrInvalidKeyID)
		}

		key, ok := j.Validating[keyID]
		if !ok {
			return nil, fmt.Errorf("unknown key id %s: %w", keyID, ErrInvalidKeyID)
		}

		return key.Public(), nil
	}), jwt.WithIssuer(j.Issuer))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse jwt: %w", err)
	}

	claims, ok := parsed.Claims.(*JWTClaims)
	if !ok {
		return nil, nil, fmt.Errorf("unknown jwt claims: %w", jwt.ErrTokenInvalidClaims)
	}

	return claims, parsed, nil
}

func readKeyPair(keypair config.KeyPair) (Key, error) {
	pk, err := readPrivateKeyFromFile(keypair.PrivateKeyPath)
	if err != nil {
		return Key{}, err
	}

	return Key{
		ID:      keypair.ID,
		Private: pk,
	}, nil
}

func readPrivateKeyFromFile(filepath string) (*rsa.PrivateKey, error) {
	bytes, err := ioutil.ReadFile(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to read private key from %s: %w", filepath, err)
	}

	block, _ := pem.Decode(bytes)
	parseResult, _ := x509.ParsePKCS8PrivateKey(block.Bytes)
	key, ok := parseResult.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("file %s does not contain RSA Private Key", filepath)
	}

	return key, nil
}

func NewJWTCookieInterceptor(exp experiments.Client, cookieName string, verifier JWTVerifier) connect.UnaryInterceptorFunc {
	interceptor := func(next connect.UnaryFunc) connect.UnaryFunc {

		return connect.UnaryFunc(func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			validJWT := false
			defer func() {
				reportRequestWithJWT(validJWT)
			}()

			if req.Spec().IsClient {
				return next(ctx, req)
			}

			token, err := TokenFromContext(ctx)
			if err != nil {
				return next(ctx, req)
			}

			if !experiments.JWTSessionsEnabled(ctx, exp, experiments.Attributes{}) {
				return next(ctx, req)
			}

			if token.Type != CookieTokenType {
				return next(ctx, req)
			}

			jwtSessionCookie, err := cookieFromString(token.Value, cookieName)
			if err != nil {
				return next(ctx, req)
			}

			claims, _, err := verifier.Verify(jwtSessionCookie.Value)
			if err != nil {
				log.Extract(ctx).WithError(err).Warnf("Failed to verify JWT session token")
				return next(ctx, req)
			}

			validJWT = claims != nil

			return next(ctx, req)
		})
	}
	return connect.UnaryInterceptorFunc(interceptor)
}

func cookieFromString(rawCookieHeader, name string) (*http.Cookie, error) {
	// To access the cookie as an http.Cookie, we sadly have to construct a request with the appropriate header such
	// that we can then extract the cookie.
	header := http.Header{}
	header.Add("Cookie", rawCookieHeader)
	req := http.Request{Header: header}

	return req.Cookie(name)
}
