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
	"github.com/spf13/cobra"

	"github.com/olekukonko/tablewriter"
)

func ListTasksCmd(cmd *cobra.Command, args []string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn := supervisor.Dial()
	client := api.NewStatusServiceClient(conn)

	tasks := supervisor.GetTasksList(ctx, client)

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

	for _, task := range tasks {
		table.Rich([]string{task.Terminal, task.Presentation.Name, task.State.String()}, []tablewriter.Colors{{}, {}, {mapStatusToColor[task.State]}})
	}

	table.Render()
}
