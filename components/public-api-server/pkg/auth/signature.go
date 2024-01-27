// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
)

type Signer interface {
	Sign(message []byte) ([]byte, error)
}

func NewHS256Signer(key []byte) *HS256Signer {
	return &HS256Signer{
		key: key,
	}
}

type HS256Signer struct {
	key []byte
}

// Signs message with HS256 (HMAC with SHA-256)
func (s *HS256Signer) Sign(message []byte) ([]byte, error) {
	h := hmac.New(sha256.New, s.key)
	_, err := h.Write(message)
	if err != nil {
		return nil, fmt.Errorf("failed to sign secret: %w", err)
	}
	return h.Sum(nil), nil
}
