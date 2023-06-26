// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"net/url"
	"strings"
)

// Claim represents a single field inside of the claim
type Claim struct {
	Key   string
	Value string
}

type Subber struct {
	// Delimiter to use between the type and value of the sub claim
	Delimiter string
	// Encode the value of the sub claim
	Encode bool
}

// NewSubClaim creates a new Subber object
func NewSubClaim(delimiter string, encode bool) *Subber {
	return &Subber{Delimiter: delimiter, Encode: encode}
}

// PrepareSubClaim generates the sub claim using the provided claims
func (s *Subber) PrepareSubClaim(claims ...Claim) (string, error) {
	var parts []string

	for _, claim := range claims {

		encodedValue := claim.Value
		if s.Encode {
			encodedValue = url.QueryEscape(claim.Value)
		}

		parts = append(parts, claim.Key+s.Delimiter+encodedValue)
	}

	return strings.Join(parts, s.Delimiter), nil
}
