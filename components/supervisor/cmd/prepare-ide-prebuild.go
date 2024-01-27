// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

var prepareIDEPrebuildCmd = &cobra.Command{
	Use:   "prepare-ide-prebuild",
	Short: "awaits when it is time to run IDE prebuild",
	Run: func(cmd *cobra.Command, args []string) {
		ctx := cmd.Context()
		for {
			conn, err := dial(ctx)
			if err == nil {
				err = checkTasks(ctx, conn)
			}

			if err == nil || ctx.Err() != nil {
				return
			}

			log.WithError(err).Error("supervisor: failed to check tasks status")

			select {
			case <-ctx.Done():
				return
			case <-time.After(1 * time.Second):
			}
		}
	},
}

func checkTasks(ctx context.Context, conn *grpc.ClientConn) error {
	client := supervisor.NewStatusServiceClient(conn)
	tasksResponse, err := client.TasksStatus(ctx, &supervisor.TasksStatusRequest{Observe: true})
	if err != nil {
		return xerrors.Errorf("failed get tasks status client: %w", err)
	}

	for {
		var runningTasksCounter int

		resp, err := tasksResponse.Recv()
		if err != nil {
			return err
		}

		for _, task := range resp.Tasks {
			idePrebuildTask := strings.Contains(task.Presentation.Name, "ide-prebuild-")
			if task.State != supervisor.TaskState_closed && !idePrebuildTask {
				runningTasksCounter++
			}
		}
		if runningTasksCounter == 0 {
			break
		}
	}

	return nil
}

func dial(ctx context.Context) (*grpc.ClientConn, error) {
	supervisorConn, err := grpc.DialContext(ctx, util.GetSupervisorAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		err = xerrors.Errorf("failed connecting to supervisor: %w", err)
	}
	return supervisorConn, err
}

func init() {
	rootCmd.AddCommand(prepareIDEPrebuildCmd)
}
