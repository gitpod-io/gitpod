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
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
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
			fmt.Println("There are no running tasks")
			return
		}

		var taskNames []string
		var taskIndex int

		if len(tasks) == 1 {
			taskIndex = 0
		} else {

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

			if selectedValue == "" {
				return
			}

			if err != nil {
				panic(err)
			}

			taskIndex = selectedIndex
		}

		terminalAlias = tasks[taskIndex].Terminal
	}

	terminalClient := api.NewTerminalServiceClient(conn)

	terminal, err := terminalClient.Get(context.Background(), &api.GetTerminalRequest{Alias: terminalAlias})
	if err != nil {
		if e, ok := status.FromError(err); ok {
			switch e.Code() {
			case codes.NotFound:
				fmt.Println("Terminal is inactive:", terminalAlias)
			default:
				fmt.Println(e.Code(), e.Message())
			}
			return
		} else {
			panic(err)
		}
	}
	ppid := int64(os.Getppid())

	if ppid == terminal.Pid {
		fmt.Println("You are already in terminal:", terminalAlias)
		return
	}

	interactive, _ := cmd.Flags().GetBool("interactive")
	forceResize, _ := cmd.Flags().GetBool("force-resize")

	supervisor.AttachToTerminal(context.Background(), terminalClient, terminalAlias, supervisor.AttachToTerminalOpts{
		ForceResize: forceResize,
		Interactive: interactive,
	})
}
