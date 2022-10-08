// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package auth

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTokenToAndFromContext(t *testing.T) {
	token := "my_token"

	extracted := TokenFromContext(TokenToContext(context.Background(), token))
	require.Equal(t, token, extracted)
}

func TestTokenFromContext_EmptyWhenNotSet(t *testing.T) {
	require.Equal(t, "", TokenFromContext(context.Background()))
}
