// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"io"

	"github.com/gitpod-io/gitpod/supervisor/api"
	log "github.com/sirupsen/logrus"
)

func GetTasksList(ctx context.Context, client api.StatusServiceClient) []*api.TaskStatus {
	listen, err := client.TasksStatus(ctx, &api.TasksStatusRequest{Observe: false})
	if err != nil {
		log.WithError(err).Error("Cannot list tasks")
	}

	taskschan := make(chan []*api.TaskStatus)

	go func() {
		for {
			resp, err := listen.Recv()
			if err != nil && err != io.EOF {
				panic(err)
			}

			chunk := resp.GetTasks()

			if chunk == nil {
				close(taskschan)
				break
			} else {
				taskschan <- chunk
			}
		}
	}()

	return <-taskschan
}

func GetTasksListByState(ctx context.Context, client api.StatusServiceClient, filterState api.TaskState) []*api.TaskStatus {
	tasks := GetTasksList(ctx, client)

	var filteredTasks []*api.TaskStatus

	for _, task := range tasks {
		if task.State == filterState {
			filteredTasks = append(filteredTasks, task)
		}
	}

	return filteredTasks
}
