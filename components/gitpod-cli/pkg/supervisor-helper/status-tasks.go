// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor_helper

import (
	"context"

	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	"golang.org/x/xerrors"
)

func GetTasksList(ctx context.Context) ([]*supervisor.TaskStatus, error) {
	conn, err := Dial(ctx)
	if err != nil {
		return nil, err
	}
	client := supervisor.NewStatusServiceClient(conn)
	respClient, err := client.TasksStatus(ctx, &supervisor.TasksStatusRequest{Observe: false})
	if err != nil {
		return nil, xerrors.Errorf("failed get tasks status client: %w", err)
	}
	resp, err := respClient.Recv()
	if err != nil {
		return nil, xerrors.Errorf("failed receive data: %w", err)
	}
	return resp.GetTasks(), nil
}

func GetTasksListByState(ctx context.Context, filterState supervisor.TaskState) ([]*supervisor.TaskStatus, error) {
	tasks, err := GetTasksList(ctx)
	if err != nil {
		return nil, err
	}
	var filteredTasks []*supervisor.TaskStatus
	for _, task := range tasks {
		if task.State == filterState {
			filteredTasks = append(filteredTasks, task)
		}
	}
	return filteredTasks, nil
}
