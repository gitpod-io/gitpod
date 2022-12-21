// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/supervisor/api"
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
		client, err := supervisor.New(context.Background())
		if err != nil {
			log.Fatal(err)
		}
		defer client.Close()

		runClient, err := supervisor.New(context.Background(), supervisor.SupervisorClientOption{
			Address: "localhost:25000",
		})
		if err == nil {
			defer runClient.Close()
		}

		var taskTerm *supervisor.TaskTerminal

		if len(args) > 0 {
			taskTerm = client.GetRunningTaskTerminalsByAlias(context.Background(), args[0], runClient)
			if taskTerm == nil {
				fmt.Printf("The selected task was not found or already stopped: %s.\nMake sure to use the correct task ID.\nUse 'gp tasks list' to obtain the task id or run 'gp tasks stop' to select the desired task\n", args[0])
				return
			}
		} else {
			terminals := client.GetRunningTaskTerminals(context.Background(), runClient)
			if len(terminals) == 0 {
				fmt.Println("There are no running tasks")
				return
			}

			var taskNames []string
			var taskIndex int

			if len(terminals) == 1 {
				taskIndex = 0
			} else {

				for _, task := range terminals {
					taskNames = append(taskNames, task.Name)
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

			taskTerm = terminals[taskIndex]
		}

		terminal, err := taskTerm.Client.Terminal.Get(context.Background(), &api.GetTerminalRequest{Alias: taskTerm.Alias})
		if err != nil {
			if e, ok := status.FromError(err); ok {
				switch e.Code() {
				case codes.NotFound:
					fmt.Println("Terminal is inactive:", taskTerm.Alias)
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
			fmt.Println("You are already in terminal:", taskTerm.Alias)
			return
		}

		interactive, _ := cmd.Flags().GetBool("interactive")
		forceResize, _ := cmd.Flags().GetBool("force-resize")

		taskTerm.Client.AttachToTerminal(context.Background(), taskTerm.Alias, supervisor.AttachToTerminalOpts{
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
