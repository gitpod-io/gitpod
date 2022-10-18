// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	supervisor_helper "github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor-helper"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	"github.com/gitpod-io/gitpod/supervisor/api"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/spf13/cobra"

	"github.com/olekukonko/tablewriter"
)

// listTasksCmd represents the tasks list command
var listTasksCmd = &cobra.Command{
	Use:   "list",
	Short: "Lists the workspace tasks and their state",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		tasks, err := supervisor_helper.GetTasksList(ctx)
		if err != nil {
			log.Fatalf("cannot get task list: %s", err)
		}

		if len(tasks) == 0 {
			fmt.Println("No tasks detected")
			return
		}

		table := tablewriter.NewWriter(os.Stdout)
		table.SetHeader([]string{"Terminal ID", "Name", "State"})
		table.SetBorders(tablewriter.Border{Left: true, Top: false, Right: true, Bottom: false})
		table.SetCenterSeparator("|")

		mapStatusToColor := map[api.TaskState]int{
			0: tablewriter.FgHiGreenColor,
			1: tablewriter.FgHiGreenColor,
			2: tablewriter.FgHiBlackColor,
		}

		mapCurrentToColor := map[bool]int{
			false: tablewriter.FgWhiteColor,
			true:  tablewriter.FgHiGreenColor,
		}

		ppid := int64(os.Getppid())

		for _, task := range tasks {
			colors := []tablewriter.Colors{}

			isCurrent := false

			if task.State == api.TaskState_running {
				terminalClient, err := supervisor_helper.GetTerminalServiceClient(context.Background())
				if err != nil {
					log.Fatalf("cannot get terminal service: %s", err)
				}

				terminal, err := terminalClient.Get(context.Background(), &supervisor.GetTerminalRequest{Alias: task.Terminal})
				if err != nil {
					panic(err)
				}

				if ppid == terminal.Pid {
					isCurrent = true
				}
			}

			if !noColor && utils.ColorsEnabled() {
				colors = []tablewriter.Colors{{mapCurrentToColor[isCurrent]}, {}, {mapStatusToColor[task.State]}}
			}

			table.Rich([]string{task.Terminal, task.Presentation.Name, task.State.String()}, colors)
		}

		table.Render()
	},
}

func init() {
	listTasksCmd.Flags().BoolVarP(&noColor, "no-color", "", false, "Disable output colorization")
	tasksCmd.AddCommand(listTasksCmd)
}
