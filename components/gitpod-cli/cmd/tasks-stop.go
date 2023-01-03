// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
)

var stopTaskCmdOpts struct {
	All bool
}

// stopTaskCmd represents the stop task command
var stopTaskCmd = &cobra.Command{
	Use:   "stop <id>",
	Short: "Stop a workspace task",
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		var (
			terminalAliases []string
			ctx             context.Context
			cancel          context.CancelFunc
		)

		client, err := supervisor.New(context.Background())
		if err != nil {
			log.Fatalf("annot get task list: %s", err)
		}
		defer client.Close()

		ctx, cancel = context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		all, _ := cmd.Flags().GetBool("all")

		if all {
			ctx, cancel = context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			tasks, err := client.GetTasksListByState(ctx, api.TaskState_running)

			if err != nil {
				log.Fatalf("cannot get task list: %s", err)
				return
			}

			if len(tasks) == 0 {
				fmt.Println("There are no running tasks")
				return
			}

			for _, task := range tasks {
				terminalAliases = append(terminalAliases, task.Terminal)
			}
		} else if len(args) > 0 {
			_, err := client.Terminal.Get(ctx, &api.GetTerminalRequest{
				Alias: args[0],
			})

			if err != nil {
				fmt.Printf("The selected task was not found or already stopped: %s.\nMake sure to use the correct task ID.\nUse 'gp tasks list' to obtain the task id or run 'gp tasks stop' to select the desired task\n", args[0])
				return
			}

			terminalAliases = append(terminalAliases, args[0])
		} else {
			tasks, err := client.GetTasksListByState(ctx, api.TaskState_running)
			if err != nil {
				log.Fatalf("cannot get task list: %s", err)
			}

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
					Label:        "What task do you want to stop?",
					Items:        taskNames,
					HideSelected: true,
				}

				selectedIndex, selectedValue, err := prompt.Run()

				if selectedValue == "" {
					return
				}

				if err != nil {
					log.Fatalf("error occurred with the input prompt: %s", err)
				}

				taskIndex = selectedIndex
			}

			terminalAliases = append(terminalAliases, tasks[taskIndex].Terminal)
		}

		for _, terminalAlias := range terminalAliases {
			_, err := client.Terminal.Shutdown(context.Background(), &api.ShutdownTerminalRequest{Alias: terminalAlias})
			if err != nil {
				log.Fatalf("cannot stop task: %s", err)
				return
			}
		}
	},
}

func init() {
	tasksCmd.AddCommand(stopTaskCmd)

	stopTaskCmd.Flags().BoolVarP(&stopTaskCmdOpts.All, "all", "a", false, "stop all tasks")
}
