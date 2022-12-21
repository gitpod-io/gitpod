// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"log"

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
		client, err := supervisor.New(context.Background())
		if err != nil {
			log.Fatalf("annot get task list: %s", err)
		}
		defer client.Close()

		runClient, err := supervisor.New(context.Background(), supervisor.SupervisorClientOption{
			Address: "localhost:25000",
		})
		if err == nil {
			defer runClient.Close()
		}

		var terminals []*supervisor.TaskTerminal
		all, _ := cmd.Flags().GetBool("all")
		if all {
			terminals = client.GetRunningTaskTerminals(context.Background(), runClient)
			if len(terminals) == 0 {
				fmt.Println("There are no running tasks")
				return
			}
		} else if len(args) > 0 {
			terminal := client.GetRunningTaskTerminalsByAlias(context.Background(), args[0], runClient)
			if terminal == nil {
				fmt.Printf("The selected task was not found or already stopped: %s.\nMake sure to use the correct task ID.\nUse 'gp tasks list' to obtain the task id or run 'gp tasks attach' to select the desired task\n", args[0])
				return
			}
			terminals = append(terminals, terminal)
		} else {
			tasks := client.GetRunningTaskTerminals(context.Background(), runClient)
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
					taskNames = append(taskNames, task.Name)
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

			terminals = append(terminals, tasks[taskIndex])
		}

		for _, terminal := range terminals {
			_, err := terminal.Client.Terminal.Shutdown(context.Background(), &api.ShutdownTerminalRequest{Alias: terminal.Alias})
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
