// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor

import (
	"context"

	"github.com/gitpod-io/gitpod/supervisor/api"
	"golang.org/x/xerrors"
)

func (client *SupervisorClient) GetTasksList(ctx context.Context) ([]*api.TaskStatus, error) {
	respClient, err := client.Status.TasksStatus(ctx, &api.TasksStatusRequest{Observe: false})
	if err != nil {
		return nil, xerrors.Errorf("failed get tasks status client: %w", err)
	}
	resp, err := respClient.Recv()
	if err != nil {
		return nil, xerrors.Errorf("failed receive data: %w", err)
	}
	return resp.GetTasks(), nil
}

func (client *SupervisorClient) GetTasksListByState(ctx context.Context, filterState api.TaskState) ([]*api.TaskStatus, error) {
	tasks, err := client.GetTasksList(ctx)
	if err != nil {
		return nil, err
	}
	var filteredTasks []*api.TaskStatus
	for _, task := range tasks {
		if task.State == filterState {
			filteredTasks = append(filteredTasks, task)
		}
	}
	return filteredTasks, nil
}
