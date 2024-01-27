// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"errors"
	"fmt"

	"github.com/bufbuild/connect-go"
	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/sourcegraph/jsonrpc2"
)

func ConvertError(err error) error {
	if err == nil {
		return nil
	}

	return categorizeRPCError(err)
}

func categorizeRPCError(err error) *connect.Error {
	if err == nil {
		return nil
	}

	if rpcErr := new(jsonrpc2.Error); errors.As(err, &rpcErr) {
		switch rpcErr.Code {
		case 400:
			return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(rpcErr.Message))
		// components/gitpod-protocol/src/messaging/error.ts
		case 401:
			return connect.NewError(connect.CodeUnauthenticated, fmt.Errorf(rpcErr.Message))
		// components/gitpod-protocol/src/messaging/error.ts
		case 403:
			return connect.NewError(connect.CodePermissionDenied, fmt.Errorf(rpcErr.Message))
		// components/gitpod-protocol/src/messaging/error.ts
		case 404:
			return connect.NewError(connect.CodeNotFound, fmt.Errorf(rpcErr.Message))
		// components/gitpod-protocol/src/messaging/error.ts
		case 409:
			return connect.NewError(connect.CodeAlreadyExists, fmt.Errorf(rpcErr.Message))
		case 412:
			return connect.NewError(connect.CodeFailedPrecondition, fmt.Errorf(rpcErr.Message))
		case 429:
			return connect.NewError(connect.CodeResourceExhausted, fmt.Errorf(rpcErr.Message))
		case 470:
			return connect.NewError(connect.CodePermissionDenied, fmt.Errorf(rpcErr.Message))
		case -32603:
			return connect.NewError(connect.CodeInternal, fmt.Errorf(rpcErr.Message))
		}
		// components/gitpod-protocol/src/messaging/error.ts - user errors
		if rpcErr.Code >= 400 && rpcErr.Code < 500 {
			return connect.NewError(connect.CodeInvalidArgument, fmt.Errorf(rpcErr.Message))
		}
		return connect.NewError(connect.CodeInternal, fmt.Errorf(rpcErr.Message))
	}

	if errors.Is(err, context.Canceled) {
		return connect.NewError(connect.CodeDeadlineExceeded, fmt.Errorf("Request timed out"))
	}

	if handshakeErr := new(protocol.ErrBadHandshake); errors.As(err, &handshakeErr) {
		return connect.NewError(connect.CodeUnauthenticated, fmt.Errorf("Failed to establish caller identity"))
	}

	return connect.NewError(connect.CodeInternal, err)
}
