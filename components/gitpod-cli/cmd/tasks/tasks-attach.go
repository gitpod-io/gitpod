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
	var terminalAlias string

	conn := supervisor.Dial()

	if len(args) > 0 {
		terminalAlias = args[0]
	} else {
		statusClient := api.NewStatusServiceClient(conn)
		stateToFilter := api.TaskState(api.TaskState_value["running"])

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		tasks := supervisor.GetTasksListByState(ctx, statusClient, stateToFilter)

		if len(tasks) == 0 {
			fmt.Println("There are no tasks available")
			return
		}

		// todo: if there is only 1 task, attach directly

		var taskNames []string

		for _, task := range tasks {
			taskNames = append(taskNames, task.Presentation.Name)
		}

		prompt := promptui.Select{
			Label: "What task do you want attach to?",
			Items: taskNames,
			Templates: &promptui.SelectTemplates{
				Selected: "Attaching to task: {{ . }}",
			},
		}

		selectedIndex, selectedValue, err := prompt.Run()

		fmt.Println("selectedValue", selectedValue)
		fmt.Println("selectedIndex", selectedIndex)

		if selectedValue == "" {
			fmt.Println("NOTHING SELECTED")
			return
		}

		if err != nil {
			panic(err)
		}

		terminalAlias = tasks[selectedIndex].Terminal
	}

	// todo: call terminal get to fetch terminal pid and avoid attaching to itself
	// ppid := os.Getppid()

	interactive, _ := cmd.Flags().GetBool("interactive")
	forceResize, _ := cmd.Flags().GetBool("force-resize")

	terminalClient := api.NewTerminalServiceClient(conn)

	supervisor.AttachToTerminal(context.Background(), terminalClient, terminalAlias, supervisor.AttachToTerminalOpts{
		ForceResize: forceResize,
		Interactive: interactive,
	})
}
