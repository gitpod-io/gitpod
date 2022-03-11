// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package tasks

import (
	"context"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

func AttachTasksCmd(cmd *cobra.Command, args []string) {
	if len(args) == 0 {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		conn := supervisor.Dial()
		statusClient := api.NewStatusServiceClient(conn)

		tasks := supervisor.GetTasksList(ctx, statusClient)

		if len(tasks) == 0 {
			fmt.Println("There are no tasks available")
			return
		}

		var taskNames []string
		// var taskIds []string

		for _, task := range tasks {
			taskNames = append(taskNames, task.Presentation.Name)
			// taskIds = append(taskIds, task.Id)
		}

		prompt := promptui.Select{
			Label: "What task do you want attach to?",
			Items: taskNames,
			Templates: &promptui.SelectTemplates{
				Selected: "Selected Task: {{ . }}",
			},
		}

		// fmt.Println(prompt)
		choice, _, err := prompt.Run()
		if err != nil {
			panic(err)
		}

		fmt.Println(choice)
		terminalClient := api.NewTerminalServiceClient(conn)

		supervisor.AttachToTerminal(context.Background(), terminalClient, tasks[choice].Terminal, supervisor.AttachToTerminalOpts{
			ForceResize: true,
			Interactive: true,
		})
	}
}
