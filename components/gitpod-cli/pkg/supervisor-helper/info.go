// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor_helper

import (
	"context"
	"fmt"

	"github.com/gitpod-io/gitpod/supervisor/api"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	"google.golang.org/grpc"
)

func FetchInfo(ctx context.Context, conn *grpc.ClientConn) (*api.WorkspaceInfoResponse, error) {
	wsInfo, err := supervisor.NewInfoServiceClient(conn).WorkspaceInfo(ctx, &supervisor.WorkspaceInfoRequest{})
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve workspace info: %w", err)
	}

	return wsInfo, nil
}
