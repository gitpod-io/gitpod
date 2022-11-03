// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package auth

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTokenToAndFromContext_AccessToken(t *testing.T) {
	token := NewAccessToken("my_token")

	extracted, err := TokenFromContext(TokenToContext(context.Background(), token))
	require.NoError(t, err)
	require.Equal(t, token, extracted)
}

func TestTokenToAndFromContext_CookieToken(t *testing.T) {
	token := NewCookieToken("my_token")

	extracted, err := TokenFromContext(TokenToContext(context.Background(), token))
	require.NoError(t, err)
	require.Equal(t, token, extracted)
}

func TestTokenFromContext_ErrorsWhenNotSet(t *testing.T) {
	_, err := TokenFromContext(context.Background())
	require.Error(t, err)
}
