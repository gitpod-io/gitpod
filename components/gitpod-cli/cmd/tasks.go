// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/fatih/color"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/rodaine/table"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"golang.org/x/term"
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
	Interactive bool
	ForceResize bool
}

// TODO(andreafalzetti): refactor tasks.go to only keep the tasks cmd initialisation, moving the subcommands in their own file

// TODO(andreafalzetti): move it somewhere else so that it's reusable from other cmds
func dialSupervisor() *grpc.ClientConn {
	supervisorAddr := os.Getenv("SUPERVISOR_ADDR")
	if supervisorAddr == "" {
		supervisorAddr = "localhost:22999"
	}
	supervisorConn, err := grpc.Dial(supervisorAddr, grpc.WithInsecure())
	if err != nil {
		fmt.Printf("failed connecting to supervisor: %v", err)
		log.WithError(err).Fatal("cannot connect to supervisor")
	}

	return supervisorConn
}

// listTasksCmd represents the tasks list command
var listTasksCmd = &cobra.Command{
	Use:   "list",
	Short: "Lists the workspace tasks and their status",
	Run: func(cmd *cobra.Command, args []string) {
		client := api.NewStatusServiceClient(dialSupervisor())

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// TODO(andreafalzetti): ask how to opt-out from the stream! {Observe: false} gives me a stream 😢
		listen, err := client.TasksStatus(ctx, &api.TasksStatusRequest{Observe: false})
		if err != nil {
			log.WithError(err).Error("Cannot list tasks")
		}

		errchan := make(chan error, 5)
		func() {
			for {
				resp, err := listen.Recv()
				if err != nil {
					errchan <- err
				}

				tasks := resp.GetTasks()

				if tasks != nil {
					headerFmt := color.New(color.FgGreen, color.Underline).SprintfFunc()
					columnFmt := color.New(color.FgYellow).SprintfFunc()

					tbl := table.New("ID", "Name", "State")
					tbl.WithHeaderFormatter(headerFmt).WithFirstColumnFormatter(columnFmt)

					for _, task := range tasks {
						tbl.AddRow(task.Id, task.Presentation.Name, task.State)
					}
					tbl.Print()
				} else {
					break
				}
			}
		}()
	},
}

// attachTaskCmd represents the attach task command
var attachTaskCmd = &cobra.Command{
	Use:   "attach <taskId>",
	Short: "Attach to a workspace task to retrieve its updates",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		client := api.NewStatusServiceClient(dialSupervisor())

		listen, err := client.TasksStatus(context.Background(), &api.TasksStatusRequest{Observe: true})
		if err != nil {
			fmt.Println("Cannot list tasks")
		}

		errchan := make(chan error, 1)
		func() {
			for {
				resp, err := listen.Recv()
				if err != nil {
					errchan <- err
				}

				tasks := resp.GetTasks()

				if tasks != nil {
					// TODO(andreafalzetti): refactor this fmt.Println with https://github.com/rodaine/table
					for _, task := range tasks {
						if args[0] == task.Id {
							fmt.Println(task.Id, task.Presentation.Name, task.State)
						}
					}
				}
			}
		}()

		oldState, err := term.MakeRaw(int(os.Stdin.Fd()))
		if err != nil {
			panic(err)
		}
		defer func() { _ = term.Restore(int(os.Stdin.Fd()), oldState) }() // Best effort.

		// wait indefinitely
		stopch := make(chan os.Signal, 1)
		signal.Notify(stopch, syscall.SIGTERM|syscall.SIGINT)
		select {
		case err := <-errchan:
			if err != io.EOF {
				log.WithError(err).Error("error")
			} else {
				os.Exit(0)
			}
		case <-stopch:
		}
	},
}

func init() {
	rootCmd.AddCommand(tasksCmd)

	tasksCmd.AddCommand(listTasksCmd)
	tasksCmd.AddCommand(attachTaskCmd)

	// TODO(andreafalzetti): implement interactive & force-resize flags
	attachTaskCmd.Flags().BoolVarP(&attachTaskCmdOpts.Interactive, "internactive", "i", false, "assume control over the terminal")
	attachTaskCmd.Flags().BoolVarP(&attachTaskCmdOpts.ForceResize, "force-resize", "r", false, "force this terminal's size irregardless of other clients")
}
