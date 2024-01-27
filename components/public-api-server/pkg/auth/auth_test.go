// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBearerTokenFromHeaders(t *testing.T) {
	type Scenario struct {
		Name string

		// Input
		Header http.Header

		// Output
		Token string
		Error error
	}

	for _, s := range []Scenario{
		{
			Name:   "happy case",
			Header: addToHeader(http.Header{}, "Authorization", "Bearer foo"),
			Token:  "foo",
		},
		{
			Name:   "leading and trailing spaces are trimmed",
			Header: addToHeader(http.Header{}, "Authorization", "  Bearer foo  "),
			Token:  "foo",
		},
		{
			Name:   "anything after Bearer is extracted",
			Header: addToHeader(http.Header{}, "Authorization", "Bearer foo bar"),
			Token:  "foo bar",
		},
		{
			Name:   "duplicate bearer",
			Header: addToHeader(http.Header{}, "Authorization", "Bearer Bearer foo"),
			Token:  "Bearer foo",
		},
		{
			Name:   "missing Bearer prefix fails",
			Header: addToHeader(http.Header{}, "Authorization", "foo"),
			Error:  NoAccessToken,
		},
		{
			Name:   "missing Authorization header fails",
			Header: http.Header{},
			Error:  NoAccessToken,
		},
	} {
		t.Run(s.Name, func(t *testing.T) {
			token, err := BearerTokenFromHeaders(s.Header)
			require.ErrorIs(t, err, s.Error)
			require.Equal(t, s.Token, token)
		})
	}
}

func addToHeader(h http.Header, key, value string) http.Header {
	h.Add(key, value)
	return h
}
