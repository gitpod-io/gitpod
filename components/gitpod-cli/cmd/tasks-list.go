// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"

	"github.com/olekukonko/tablewriter"
)

// listTasksCmd represents the tasks list command
var listTasksCmd = &cobra.Command{
	Use:   "list",
	Short: "Lists the workspace tasks and their state",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 5*time.Second)
		defer cancel()

		client, err := supervisor.New(ctx)
		if err != nil {
			return xerrors.Errorf("cannot get task list: %w", err)
		}
		defer client.Close()

		tasks, err := client.GetTasksList(ctx)
		if err != nil {
			return xerrors.Errorf("cannot get task list: %w", err)
		}

		if len(tasks) == 0 {
			fmt.Println("No tasks detected")
			return nil
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
				terminal, err := client.Terminal.Get(ctx, &api.GetTerminalRequest{Alias: task.Terminal})
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
		return nil
	},
}

func init() {
	listTasksCmd.Flags().BoolVarP(&noColor, "no-color", "", false, "Disable output colorization")
	tasksCmd.AddCommand(listTasksCmd)
}
