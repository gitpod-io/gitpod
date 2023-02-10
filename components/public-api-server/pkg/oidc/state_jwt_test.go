// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package oidc

import (
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/stretchr/testify/require"
)

func Test_Encode(t *testing.T) {
	stateJWT := NewStateJWT([]byte("ANY KEY"))
	encodedState, err := stateJWT.Encode(StateClaims{
		ClientConfigID: "test-id",
		ReturnToURL:    "test-url",
	})
	require.NoError(t, err)
	// check for header: { "alg": "HS256", "typ": "JWT" }
	require.Contains(t, encodedState, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.", "")
}

func Test_Decode(t *testing.T) {

	testCases := []struct {
		Label         string
		Key4Encode    string
		expiresIn     time.Duration
		Key4Decode    string
		ExpectedError string
	}{
		{
			Label:         "happy path",
			Key4Encode:    "ANY KEY",
			expiresIn:     5 * time.Minute,
			Key4Decode:    "ANY KEY",
			ExpectedError: "",
		},
		{
			Label:         "expired state token",
			Key4Encode:    "ANY KEY",
			expiresIn:     0 * time.Second,
			Key4Decode:    "ANY KEY",
			ExpectedError: "token is expired",
		},
		{
			Label:         "signature is invalid",
			Key4Encode:    "OTHER KEY",
			expiresIn:     5 * time.Minute,
			Key4Decode:    "ANY KEY",
			ExpectedError: jwt.ErrSignatureInvalid.Error(),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Label, func(t *testing.T) {
			encoder := newTestStateJWT([]byte(tc.Key4Encode), tc.expiresIn)
			decoder := NewStateJWT([]byte(tc.Key4Decode))
			encodedState, err := encoder.Encode(StateClaims{
				ClientConfigID: "test-id",
				ReturnToURL:    "test-url",
			})
			if err != nil && tc.ExpectedError == "" {
				require.FailNowf(t, "Unexpected error on `Encode`.", "Error: %", err)
			}
			_, err = decoder.Decode(encodedState)
			if err != nil && tc.ExpectedError == "" {
				require.FailNowf(t, "Unexpected error on `Decode`.", "Error: %", err)
			}
			if err != nil && !strings.Contains(err.Error(), tc.ExpectedError) {
				require.FailNowf(t, "Unmatched error.", "Got error: %", err.Error())
			}
		})
	}

}
