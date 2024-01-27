// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/manifoldco/promptui"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
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
	RunE: func(cmd *cobra.Command, args []string) error {
		client, err := supervisor.New(cmd.Context())
		if err != nil {
			return err
		}
		defer client.Close()

		var terminalAlias string

		if len(args) > 0 {
			terminalAlias = args[0]
		} else {
			tasks, err := client.GetTasksListByState(cmd.Context(), api.TaskState_running)
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
					Label: "What task do you want attach to?",
					Items: taskNames,
					Templates: &promptui.SelectTemplates{
						Selected: "Attaching to task: {{ . }}",
					},
				}

				selectedIndex, selectedValue, err := prompt.Run()

				if selectedValue == "" {
					return nil
				}

				if err != nil {
					return err
				}

				taskIndex = selectedIndex
			}

			terminalAlias = tasks[taskIndex].Terminal
		}

		terminal, err := client.Terminal.Get(cmd.Context(), &api.GetTerminalRequest{Alias: terminalAlias})
		if err != nil {
			if e, ok := status.FromError(err); ok {
				switch e.Code() {
				case codes.NotFound:
					fmt.Println("Terminal is inactive:", terminalAlias)
				default:
					fmt.Println(e.Code(), e.Message())
				}
				return nil
			} else {
				return err
			}
		}
		ppid := int64(os.Getppid())

		if ppid == terminal.Pid {
			fmt.Println("You are already in terminal:", terminalAlias)
			return GpError{OutCome: utils.UserErrorCode, ErrorCode: utils.UserErrorCode_AlreadyAttached}
		}

		interactive, _ := cmd.Flags().GetBool("interactive")
		forceResize, _ := cmd.Flags().GetBool("force-resize")

		exitCode, err := client.AttachToTerminal(cmd.Context(), terminalAlias, supervisor.AttachToTerminalOpts{
			ForceResize: forceResize,
			Interactive: interactive,
		})
		if err != nil {
			return err
		}
		return GpError{ExitCode: &exitCode, OutCome: utils.Outcome_Success, Silence: true}
	},
}

func init() {
	tasksCmd.AddCommand(attachTaskCmd)

	attachTaskCmd.Flags().BoolVarP(&attachTaskCmdOpts.Interactive, "interactive", "i", true, "assume control over the terminal")
	attachTaskCmd.Flags().BoolVarP(&attachTaskCmdOpts.ForceResize, "force-resize", "r", true, "force this terminal's size irregardless of other clients")
}
