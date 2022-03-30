// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package tasks

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"

	"encoding/json"
)

type Task struct {
	Name    string `json:"name"`
	Before  string `json:"before"`
	Init    string `json:"init"`
	Command string `json:"command"`
}

func RestartTaskCmd(cmd *cobra.Command, args []string) {
	// TODO: handle restart <name>

	rawJsonTasks := os.Getenv("GITPOD_TASKS")

	// TODO: read tasks from .gitpod.yml to also allowing quickly testing changes in .gitpod.yml

	tasks := []Task{}
	err := json.Unmarshal([]byte(rawJsonTasks), &tasks)

	if err != nil {
		panic(err)
	}

	var taskNames []string

	for _, task := range tasks {
		taskNames = append(taskNames, task.Name)
	}

	prompt := promptui.Select{
		Label: "What task do you want to restart?",
		Items: taskNames,
		Templates: &promptui.SelectTemplates{
			Selected: "Restarting task: {{ . }}",
		},
	}

	selectedIndex, selectedValue, err := prompt.Run()

	if err != nil {
		panic(err)
	}

	var terminalAlias string

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn := supervisor.Dial()

	statusClient := api.NewStatusServiceClient(conn)

	// TODO: detect if the terminal has been closed and open a new one
	for _, task := range supervisor.GetTasksList(ctx, statusClient) {
		if task.Presentation.Name == selectedValue {
			terminalAlias = task.Terminal
		}
	}

	terminalClient := api.NewTerminalServiceClient(conn)

	restartCmd := fmt.Sprintf("%s%s%s%s%s", tasks[selectedIndex].Before, "\n", tasks[selectedIndex].Init, "\n", tasks[selectedIndex].Command)

	_, err = terminalClient.Write(ctx, &api.WriteTerminalRequest{Alias: terminalAlias, Stdin: []byte(restartCmd)})

	if err != nil {
		panic(err)
	}
}
