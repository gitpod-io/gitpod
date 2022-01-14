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

	"github.com/gitpod-io/gitpod/supervisor/api"
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

// This func was copied from https://github.com/gitpod-io/gitpod/blob/main/components/supervisor/cmd/terminal.go#L29
// TODO(andreafalzetti): move it somewhere else so that it's reusable from other cmds
func dialSupervisor() *grpc.ClientConn {
	// TODO(andreafalzetti): figure out how to import peroperly supervisor.GetConfig()
	// cfg, err := supervisor.GetConfig()
	// if err != nil {
	// 	log.WithError(err).Fatal("cannot get config")
	// }

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	url := fmt.Sprintf("localhost:%d", 22999)
	conn, err := grpc.DialContext(ctx, url, grpc.WithInsecure(), grpc.WithBlock())
	if err != nil {
		log.WithError(err).Fatal("cannot connect to supervisor")
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
			client = api.NewStatusServiceClient(dialSupervisor())
		)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// TODO(andreafalzetti): ask how to opt-out from the stream! {Observe: false} gives me a stream 😢
		listen, err := client.TasksStatus(ctx, &api.TasksStatusRequest{Observe: false})
		if err != nil {
			fmt.Println("Cannot list tasks")
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
					// TODO(andreafalzetti): refactor this fmt.Println with https://github.com/rodaine/table
					for _, task := range tasks {
						fmt.Println(task.Id, task.Presentation.Name, task.State)
					}
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
		fmt.Println(args)

		var (
			client = api.NewStatusServiceClient(dialSupervisor())
		)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		listen, err := client.TasksStatus(ctx, &api.TasksStatusRequest{Observe: true})
		if err != nil {
			fmt.Println("Cannot list tasks")
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

	// attachTaskCmd.Flags().StringVar(&attachTaskCmdOpts.TaskId, "format", "text | json", "")

	attachTaskCmd.Flags().BoolVarP(&attachTaskCmdOpts.Interactive, "internactive", "i", false, "assume control over the terminal")
	attachTaskCmd.Flags().BoolVarP(&attachTaskCmdOpts.ForceResize, "force-resize", "r", false, "force this terminal's size irregardless of other clients")
}
