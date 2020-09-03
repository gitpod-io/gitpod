package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/supervisor"

	"github.com/spf13/cobra"
	"google.golang.org/grpc"
)

var backupCmd = &cobra.Command{
	Use:   "backup",
	Short: "triggers a workspace backup",

	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := supervisor.GetConfig()
		if err != nil {
			log.WithError(err).Fatal("cannot get config")
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		url := fmt.Sprintf("localhost:%d", cfg.APIEndpointPort)
		conn, err := grpc.DialContext(ctx, url, grpc.WithInsecure(), grpc.WithBlock())
		if err != nil {
			log.WithError(err).Fatal("cannot connect to supervisor")
		}
		defer conn.Close()

		client := api.NewBackupServiceClient(conn)
		_, err = client.Prepare(ctx, &api.PrepareBackupRequest{})
		if err != nil {
			log.WithError(err).Fatal("cannot prepare backup")
		}
	},
}

func init() {
	containerCmd.AddCommand(backupCmd)
}
