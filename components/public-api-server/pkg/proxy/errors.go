// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"strings"

	"github.com/bufbuild/connect-go"
)

func ConvertError(err error) error {
	if err == nil {
		return nil
	}

	s := err.Error()

	// components/gitpod-protocol/src/messaging/error.ts
	if strings.Contains(s, "code 400") {
		return connect.NewError(connect.CodeInvalidArgument, err)
	}

	// components/gitpod-protocol/src/messaging/error.ts
	if strings.Contains(s, "code 401") {
		return connect.NewError(connect.CodePermissionDenied, err)
	}

	// components/gitpod-protocol/src/messaging/error.ts
	if strings.Contains(s, "code 403") {
		return connect.NewError(connect.CodePermissionDenied, err)
	}

	// components/gitpod-protocol/src/messaging/error.ts
	if strings.Contains(s, "code 404") {
		return connect.NewError(connect.CodeNotFound, err)
	}

	// components/gitpod-protocol/src/messaging/error.ts
	if strings.Contains(s, "code 409") {
		return connect.NewError(connect.CodeAlreadyExists, err)
	}

	// components/gitpod-messagebus/src/jsonrpc-server.ts#47
	if strings.Contains(s, "code -32603") {
		return connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewError(connect.CodeInternal, err)
}
