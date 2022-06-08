// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"errors"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"testing"
)

func TestConvertError(t *testing.T) {
	scenarios := []struct {
		WebsocketError error
		ExpectedStatus codes.Code
	}{
		{
			WebsocketError: errors.New("reconnecting-ws: bad handshake: code 401 - URL: wss://main.preview.gitpod-dev.com/api/v1 - headers: map[Authorization:[Bearer foo] Origin:[http://main.preview.gitpod-dev.com/]]"),
			ExpectedStatus: codes.PermissionDenied,
		},
		{
			WebsocketError: errors.New("jsonrpc2: code -32603 message: Request getWorkspace failed with message: No workspace with id 'some-id' found."),
			ExpectedStatus: codes.Internal,
		},
	}

	for _, s := range scenarios {
		converted := ConvertError(s.WebsocketError)
		require.Equal(t, s.ExpectedStatus, status.Code(converted))
		// the error message should remain the same
		require.Equal(t, s.WebsocketError.Error(), status.Convert(converted).Message())
	}
}
