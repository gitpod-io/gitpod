// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package auth

import (
	crypto_rand "crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"math/rand"
	math_rand "math/rand"
	"time"
)

func init() {
	PKCEInit()
}

// PKCEInit ensures we use random values to generate the PKCE verifier
func PKCEInit() {
	var seed int64
	var b [8]byte
	// We'd like more entropy than UnixNano() for PKCE
	_, err := crypto_rand.Read(b[:])
	if err == nil {
		seed = int64(binary.LittleEndian.Uint64(b[:]))
	} else {
		// ... but will accept it if we have to
		seed = time.Now().UnixNano()
	}
	math_rand.Seed(seed)
}

// PKCEVerifier generates a string of pkce allowed chars
func PKCEVerifier(length int) string {
	if length > 128 {
		length = 128
	}
	if length < 43 {
		length = 43
	}
	const charset = "abcdefghijklmnopqrstuvwxyz" +
		"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}

// PKCEChallenge base64-URL-encodes the SHA256 hash of verifier, per rfc 7636
func PKCEChallenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(sum[:])
	return (challenge)
}
