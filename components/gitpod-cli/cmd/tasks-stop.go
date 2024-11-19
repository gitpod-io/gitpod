// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
)

var stopTaskCmdOpts struct {
	All          bool
	ForceSuccess bool
}

// stopTaskCmd represents the stop task command
var stopTaskCmd = &cobra.Command{
	Use:   "stop <id>",
	Short: "Stop a workspace task",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		var (
			terminalAliases []string
		)

		client, err := supervisor.New(ctx)
		if err != nil {
			return xerrors.Errorf("cannot get task list: %w", err)
		}
		defer client.Close()

		all, _ := cmd.Flags().GetBool("all")

		if all {
			tasks, err := client.GetTasksListByState(ctx, api.TaskState_running)

			if err != nil {
				return xerrors.Errorf("cannot get task list: %w", err)
			}

			if len(tasks) == 0 {
				fmt.Println("There are no running tasks")
				return nil
			}

			for _, task := range tasks {
				terminalAliases = append(terminalAliases, task.Terminal)
			}
		} else if len(args) > 0 {
			_, err := client.Terminal.Get(ctx, &api.GetTerminalRequest{
				Alias: args[0],
			})

			if err != nil {
				msg := fmt.Sprintf("The selected task was not found or already stopped: %s.\nMake sure to use the correct task ID.\nUse 'gp tasks list' to obtain the task id or run 'gp tasks stop' to select the desired task\n", args[0])
				return GpError{Err: err, Message: msg, OutCome: utils.Outcome_UserErr}
			}

			terminalAliases = append(terminalAliases, args[0])
		} else {
			tasks, err := client.GetTasksListByState(ctx, api.TaskState_running)
			if err != nil {
				return xerrors.Errorf("cannot get task list: %w", err)
			}

			if len(tasks) == 0 {
				fmt.Println("There are no running tasks")
				return nil
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
					return nil
				}

				if err != nil {
					return xerrors.Errorf("error occurred with the input prompt: %w", err)
				}

				taskIndex = selectedIndex
			}

			terminalAliases = append(terminalAliases, tasks[taskIndex].Terminal)
		}

		for _, terminalAlias := range terminalAliases {
			_, err = client.Terminal.Shutdown(ctx, &api.ShutdownTerminalRequest{Alias: terminalAlias, ForceSuccess: stopTaskCmdOpts.ForceSuccess})
			if err != nil {
				return xerrors.Errorf("cannot stop task: %w", err)
			}
		}
		return nil
	},
}

func init() {
	tasksCmd.AddCommand(stopTaskCmd)

	stopTaskCmd.Flags().BoolVarP(&stopTaskCmdOpts.All, "all", "a", false, "stop all tasks")
	stopTaskCmd.Flags().BoolVarP(&stopTaskCmdOpts.ForceSuccess, "force-success", "f", false, "force the task to exit with status code 0")
}
