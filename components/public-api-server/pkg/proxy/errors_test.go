// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"errors"
	"fmt"
	"testing"

	"github.com/bufbuild/connect-go"
	"github.com/stretchr/testify/require"
)

func TestConvertError(t *testing.T) {
	scenarios := []struct {
		WebsocketError error
		ExpectedStatus connect.Code
	}{
		{
			WebsocketError: errors.New("reconnecting-ws: bad handshake: code 401 - URL: wss://main.preview.gitpod-dev.com/api/v1 - headers: map[Authorization:[Bearer foo] Origin:[http://main.preview.gitpod-dev.com/]]"),
			ExpectedStatus: connect.CodePermissionDenied,
		},
		{
			WebsocketError: errors.New("jsonrpc2: code -32603 message: Request getWorkspace failed with message: No workspace with id 'some-id' found."),
			ExpectedStatus: connect.CodeInternal,
		},
		{
			WebsocketError: errors.New("code 400"),
			ExpectedStatus: connect.CodeInvalidArgument,
		},
		{
			WebsocketError: errors.New("code 409"),
			ExpectedStatus: connect.CodeAlreadyExists,
		},
	}

	for _, s := range scenarios {
		converted := ConvertError(s.WebsocketError)
		require.Equal(t, s.ExpectedStatus, connect.CodeOf(converted))
		// the error message should remain the same
		require.Equal(t, fmt.Errorf("%s: %w", s.ExpectedStatus.String(), s.WebsocketError).Error(), converted.Error())
	}
}
