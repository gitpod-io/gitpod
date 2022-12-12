// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"context"
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
		Input         error
		ExpectedError error
	}{
		{
			Input: &protocol.ErrBadHandshake{
				URL: "https://foo.bar",
			},
			ExpectedError: connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("Failed to establish caller identity")),
		},
		{
			Input: &jsonrpc2.Error{
				Code:    400,
				Message: "user id is a required argument",
			},
			ExpectedError: connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("user id is a required argument")),
		},
		{
			Input: &jsonrpc2.Error{
				Code:    -32603,
				Message: "Request getWorkspace failed with message: No workspace with id 'some-id' found.",
			},
			ExpectedError: connect.NewError(connect.CodeInternal, fmt.Errorf("Request getWorkspace failed with message: No workspace with id 'some-id' found.")),
		},
		{
			Input: &jsonrpc2.Error{
				Code:    409,
				Message: "already exists",
			},
			ExpectedError: connect.NewError(connect.CodeAlreadyExists, fmt.Errorf("already exists")),
		},
		{
			Input: &jsonrpc2.Error{
				Code:    470,
				Message: "user blocked",
			},
			ExpectedError: connect.NewError(connect.CodePermissionDenied, fmt.Errorf("user blocked")),
		},
		{
			Input:         nil,
			ExpectedError: nil,
		},
		{
			Input:         errors.New("some other random error returns internal error"),
			ExpectedError: connect.NewError(connect.CodeInternal, fmt.Errorf("some other random error returns internal error")),
		},
		{
			Input:         context.Canceled,
			ExpectedError: connect.NewError(connect.CodeDeadlineExceeded, fmt.Errorf("Request timed out")),
		},
	}

	for _, s := range scenarios {
		converted := ConvertError(s.Input)
		require.Equal(t, s.ExpectedError, converted)
	}
}
