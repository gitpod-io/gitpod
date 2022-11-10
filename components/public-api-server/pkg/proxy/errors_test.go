// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"errors"
	"fmt"
	"testing"

	"github.com/bufbuild/connect-go"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/sourcegraph/jsonrpc2"
	"github.com/stretchr/testify/require"
)

func TestConvertError(t *testing.T) {
	scenarios := []struct {
		WebsocketError error
		ExpectedError  error
	}{
		{
			WebsocketError: &protocol.ErrBadHandshake{
				URL: "https://foo.bar",
			},
			ExpectedError: connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("Failed to establish caller identity")),
		},
		{
			WebsocketError: &jsonrpc2.Error{
				Code:    400,
				Message: "user id is a required argument",
			},
			ExpectedError: connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("user id is a required argument")),
		},
		{
			WebsocketError: &jsonrpc2.Error{
				Code:    -32603,
				Message: "Request getWorkspace failed with message: No workspace with id 'some-id' found.",
			},
			ExpectedError: connect.NewError(connect.CodeInternal, fmt.Errorf("Request getWorkspace failed with message: No workspace with id 'some-id' found.")),
		},
		{
			WebsocketError: &jsonrpc2.Error{
				Code:    409,
				Message: "already exists",
			},
			ExpectedError: connect.NewError(connect.CodeAlreadyExists, fmt.Errorf("already exists")),
		},
		{
			WebsocketError: &jsonrpc2.Error{
				Code:    470,
				Message: "user blocked",
			},
			ExpectedError: connect.NewError(connect.CodePermissionDenied, fmt.Errorf("user blocked")),
		},
		{
			WebsocketError: nil,
			ExpectedError:  nil,
		},
		{
			WebsocketError: errors.New("some other random error returns internal error"),
			ExpectedError:  connect.NewError(connect.CodeInternal, fmt.Errorf("some other random error returns internal error")),
		},
	}

	for _, s := range scenarios {
		converted := ConvertError(s.WebsocketError)
		require.Equal(t, s.ExpectedError, converted)
	}
}
