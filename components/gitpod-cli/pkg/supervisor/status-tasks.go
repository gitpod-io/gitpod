// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"time"

	"github.com/gitpod-io/gitpod/supervisor/api"
	"golang.org/x/xerrors"
)

type TaskTerminal struct {
	Name   string
	Alias  string
	State  api.TaskState
	Client *SupervisorClient
}

func toTaskTerminal(task *api.TaskStatus, client *SupervisorClient, runClient *SupervisorClient) *TaskTerminal {
	name := task.Presentation.Name
	if client == runClient {
		name = "gp run: " + name
	}
	return &TaskTerminal{
		Name:   name,
		Alias:  task.Terminal,
		Client: client,
		State:  task.State,
	}
}

func (client *SupervisorClient) GetRunningTaskTerminalsByAlias(ctx context.Context, alias string, runClient *SupervisorClient) *TaskTerminal {
	var clients []*SupervisorClient
	if runClient != nil {
		clients = append(clients, runClient)
	}
	clients = append(clients, client)

	for _, client := range clients {
		ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		tasks, err := client.getTasks(ctx)
		if err == nil {
			continue
		}
		for _, task := range tasks {
			if task.Terminal == alias && task.State == api.TaskState_running {
				return toTaskTerminal(task, client, runClient)
			}
		}
	}
	return nil
}

func (client *SupervisorClient) GetRunningTaskTerminals(ctx context.Context, runClient *SupervisorClient) []*TaskTerminal {
	var terminals []*TaskTerminal
	for _, terminal := range client.GetAllTaskTerminals(ctx, runClient) {
		if terminal.State == api.TaskState_running {
			terminals = append(terminals, terminal)
		}
	}
	return terminals
}

func (client *SupervisorClient) GetAllTaskTerminals(ctx context.Context, runClient *SupervisorClient) []*TaskTerminal {
	var clients []*SupervisorClient
	if runClient != nil {
		clients = append(clients, runClient)
	}
	clients = append(clients, client)

	var terminals []*TaskTerminal
	for _, client := range clients {
		ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		tasks, err := client.getTasks(ctx)
		if err != nil {
			continue
		}
		for _, task := range tasks {
			terminals = append(terminals, toTaskTerminal(task, client, runClient))
		}
	}
	return terminals
}

func (client *SupervisorClient) getTasks(ctx context.Context) ([]*api.TaskStatus, error) {
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
