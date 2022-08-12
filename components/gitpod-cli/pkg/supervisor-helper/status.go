// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor_helper

import (
	"context"

	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
)

func GetWorkspaceResources(ctx context.Context) (*supervisor.ResourcesStatusResponse, error) {
	conn, err := Dial(ctx)
	if err != nil {
		return nil, err
	}
	client := supervisor.NewStatusServiceClient(conn)
	workspaceResources, workspaceResourcesError := client.ResourcesStatus(ctx, &supervisor.ResourcesStatusRequest{})

	if workspaceResourcesError != nil {
		return nil, workspaceResourcesError
	}

	return workspaceResources, nil
}
