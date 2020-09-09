package cmd

import (
	"context"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"

	"github.com/spf13/cobra"
)

var backupCmd = &cobra.Command{
	Use:   "backup",
	Short: "triggers a workspace backup",

	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		client := api.NewBackupServiceClient(dialSupervisor())
		_, err := client.Prepare(ctx, &api.PrepareBackupRequest{})
		if err != nil {
			log.WithError(err).Fatal("cannot prepare backup")
		}
	},
}

func init() {
	containerCmd.AddCommand(backupCmd)
}
