package cmd

import (
	"github.com/gitpod-io/gitpod/supervisor/pkg/supervisor"
	"github.com/spf13/cobra"
)

var runCmd = &cobra.Command{
	Use:   "run",
	Short: "starts the supervisor",

	Run: func(cmd *cobra.Command, args []string) {
		supervisor.Run()
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}
