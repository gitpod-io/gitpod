// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/gitpod-cli/cmd/tasks"
	"github.com/spf13/cobra"
)

// tasksCmd represents the tasks command
var tasksCmd = &cobra.Command{
	Use:   "tasks",
	Short: "Interact with workspace tasks",
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) == 0 {
			cmd.Help()
		}
	},
}

var attachTaskCmdOpts struct {
	Interactive bool
	ForceResize bool
}

// listTasksCmd represents the tasks list command
var listTasksCmd = &cobra.Command{
	Use:   "list",
	Short: "Lists the workspace tasks and their state",
	Run:   tasks.ListTasksCmd,
}

// attachTaskCmd represents the attach task command
var attachTaskCmd = &cobra.Command{
	Use:   "attach <id>",
	Short: "Attach to a workspace task",
	Args:  cobra.MaximumNArgs(1),
	Run:   tasks.AttachTasksCmd,
}

func init() {
	rootCmd.AddCommand(tasksCmd)

	tasksCmd.AddCommand(listTasksCmd)
	tasksCmd.AddCommand(attachTaskCmd)

	attachTaskCmd.Flags().BoolVarP(&attachTaskCmdOpts.Interactive, "interactive", "i", true, "assume control over the terminal")
	attachTaskCmd.Flags().BoolVarP(&attachTaskCmdOpts.ForceResize, "force-resize", "r", true, "force this terminal's size irregardless of other clients")
}
