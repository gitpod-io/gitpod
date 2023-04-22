// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package jws

import (
	"errors"

	"github.com/golang-jwt/jwt/v5"
)

const KeyIDName = "kid"

var (
	ErrInvalidKeyID = errors.New("token has invalid key id")
)

type Signer interface {
	Sign(*jwt.Token) (string, error)
}

type Verifier interface {
	Verify(string, jwt.Claims, ...jwt.ParserOption) (*jwt.Token, error)
}

type SignerVerifier interface {
	Signer
	Verifier
}
