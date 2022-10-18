// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor_helper

import (
	"context"

	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	"google.golang.org/grpc"
)

func GetWorkspaceResources(ctx context.Context, conn *grpc.ClientConn) (*supervisor.ResourcesStatusResponse, error) {
	client := supervisor.NewStatusServiceClient(conn)
	workspaceResources, workspaceResourcesError := client.ResourcesStatus(ctx, &supervisor.ResourcesStatuRequest{})

	if workspaceResourcesError != nil {
		return nil, workspaceResourcesError
	}

	return workspaceResources, nil
}
