// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"regexp"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGeneratePersonalAccessToken(t *testing.T) {
	signer := NewHS256Signer([]byte("my-secret"))

	pat, err := GeneratePersonalAccessToken(signer)
	require.NoError(t, err)

	signature, err := signer.Sign([]byte(pat.value))
	require.NoError(t, err)

	require.NotEmpty(t, pat.value)
	require.Len(t, pat.value, 40)
	require.Equal(t, PersonalAccessToken{
		prefix:    PersonalAccessTokenPrefix,
		value:     pat.value,
		signature: base64.RawURLEncoding.EncodeToString(signature),
	}, pat)
	require.Equal(t, fmt.Sprintf("%s%s.%s", pat.prefix, pat.signature, pat.value), pat.String())

	// must also be able to parse the token back
	parsed, err := ParsePersonalAccessToken(pat.String(), signer)
	require.NoError(t, err)
	require.Equal(t, pat, parsed)
}

func TestPersonalAccessToken_HashValue(t *testing.T) {
	signer := NewHS256Signer([]byte("my-secret"))
	pat, err := GeneratePersonalAccessToken(signer)
	require.NoError(t, err)

	h := sha256.Sum256([]byte(pat.value))

	require.Equal(t, hex.EncodeToString(h[:]), pat.ValueHash(), "hash value must be hex sha-256 hash of value")
}

func TestParsePersonalAccessToken_Errors(t *testing.T) {
	signer := NewHS256Signer([]byte("my-secret"))

	scenarios := []struct {
		Name  string
		Token string
	}{
		{
			Name:  "empty token is rejected",
			Token: "",
		},
		{
			Name:  "invalid prefix",
			Token: "gitpod_yolo_fooo",
		},
		{
			Name:  "invalid token with correct prefix",
			Token: "gitpod_pat_foo",
		},
		{
			Name:  "invalid token with correct prefix and empty value and signature",
			Token: "gitpod_pat_.",
		},
		{
			Name:  "invalid token with correct prefix but missing signature",
			Token: "gitpod_pat_.value",
		},
		{
			Name:  "invalid token with correct prefix but missing value",
			Token: "gitpod_pat_signature.",
		},
		{
			Name:  "invalid signature",
			Token: "gitpod_pat_signature.value",
		},
	}

	for _, s := range scenarios {
		t.Run(s.Name, func(t *testing.T) {
			_, err := ParsePersonalAccessToken(s.Token, signer)
			require.Error(t, err)
		})

	}
}

func TestGenerateTokenValue_OnlyAlphaNumberic(t *testing.T) {
	sizes := []int{10, 20, 30, 40, 50, 60, 70, 80}

	var tokens []string
	for _, size := range sizes {
		for i := 0; i < 10; i++ {
			token, err := generateTokenValue(size)
			require.NoError(t, err)

			tokens = append(tokens, token)
		}
	}

	for _, token := range tokens {
		rxp := regexp.MustCompile(`([a-zA-Z]|\d)+`)
		require.Regexp(t, rxp, token, "must match alphanumeric")
	}
}

func TestGenerateTokenValue_FailsWithSizeZeroOrSmaller(t *testing.T) {
	_, err := generateTokenValue(0)
	require.Error(t, err)

	_, err = generateTokenValue(-1)
	require.Error(t, err)
}
