// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	supervisor_helper "github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor-helper"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var attachTaskCmdOpts struct {
	Interactive bool
	ForceResize bool
}

// attachTaskCmd represents the attach task command
var attachTaskCmd = &cobra.Command{
	Use:   "attach <id>",
	Short: "Attach to a workspace task",
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		var terminalAlias string

		if len(args) > 0 {
			terminalAlias = args[0]
		} else {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			tasks, err := supervisor_helper.GetTasksListByState(ctx, supervisor.TaskState_running)
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

		terminalClient, err := supervisor_helper.GetTerminalServiceClient(context.Background())
		if err != nil {
			log.Fatalf("cannot get terminal service: %s", err)
		}

		terminal, err := terminalClient.Get(context.Background(), &supervisor.GetTerminalRequest{Alias: terminalAlias})
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

		supervisor_helper.AttachToTerminal(context.Background(), terminalClient, terminalAlias, supervisor_helper.AttachToTerminalOpts{
			ForceResize: forceResize,
			Interactive: interactive,
		})
	},
}

func init() {
	tasksCmd.AddCommand(attachTaskCmd)

	attachTaskCmd.Flags().BoolVarP(&attachTaskCmdOpts.Interactive, "interactive", "i", true, "assume control over the terminal")
	attachTaskCmd.Flags().BoolVarP(&attachTaskCmdOpts.ForceResize, "force-resize", "r", true, "force this terminal's size irregardless of other clients")
}
