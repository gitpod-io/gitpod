// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"strings"
)

func ConvertError(err error) error {
	if err == nil {
		return nil
	}

	s := err.Error()

	if strings.Contains(s, "code 401") {
		return status.Error(codes.PermissionDenied, s)
	}

	// components/gitpod-protocol/src/messaging/error.ts
	if strings.Contains(s, "code 404") {
		return status.Error(codes.NotFound, s)
	}

	// components/gitpod-messagebus/src/jsonrpc-server.ts#47
	if strings.Contains(s, "code -32603") {
		return status.Error(codes.Internal, s)
	}

	return status.Error(codes.Internal, s)
}
