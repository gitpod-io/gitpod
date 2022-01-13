// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
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
	TaskId string
}

// copied from https://github.com/gitpod-io/gitpod/blob/main/components/supervisor/cmd/terminal.go#L29
// TODO: move it somewhere else so that it's reusable from other cmds
func dialSupervisor() *grpc.ClientConn {
	cfg, err := supervisor.GetConfig()
	if err != nil {
		fmt.Println("Cannot get config")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	url := fmt.Sprintf("localhost:%d", cfg.APIEndpointPort)
	conn, err := grpc.DialContext(ctx, url, grpc.WithInsecure(), grpc.WithBlock())
	if err != nil {
		fmt.Println("Cannot connect to supervisor")
	}

	// TODO(cw): devise some means to properly close the connection

	return conn
}

// listTasksCmd represents the tasks list command
var listTasksCmd = &cobra.Command{
	Use:   "list",
	Short: "Lists the workspace tasks and their status",
	Run: func(cmd *cobra.Command, args []string) {
		var (
			alias  string
			client = api.NewTerminalServiceClient(dialSupervisor())
		)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		resp, err := client.List(ctx, &api.ListTerminalsRequest{})

		if err != nil {
			fmt.Println("Cannot list tasks")
		}
		if len(resp.Terminals) == 0 {
			fmt.Println("No tasks available")
		}
		if len(resp.Terminals) > 1 {
			fmt.Fprintln(os.Stderr, "More than one terminal, please choose explicitly:")
			for _, r := range resp.Terminals {
				fmt.Fprintf(os.Stderr, "\t%s\n", r.Alias)
			}
			os.Exit(1)
		}
	},
}

// attachTaskCmd represents the attach task command
var attachTaskCmd = &cobra.Command{
	Use:   "attach",
	Short: "Attach to a workspace task to retrieve updates",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("TOOD")
	},
}

func init() {
	rootCmd.AddCommand(tasksCmd)

	tasksCmd.AddCommand(listTasksCmd)
	tasksCmd.AddCommand(attachTaskCmd)

	attachTaskCmd.Flags().StringVar(&attachTaskCmdOpts.TaskId, "task id", "", "")
}
