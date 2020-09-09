package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/spf13/cobra"
)

var terminalNewOpts struct {
	Detach bool
}

var terminalNewCmd = &cobra.Command{
	Use:   "new",
	Short: "opens a new terminal",
	Run: func(cmd *cobra.Command, args []string) {
		client := api.NewTerminalServiceClient(dialSupervisor())

		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		resp, err := client.Open(ctx, &api.OpenTerminalRequest{})
		if err != nil {
			log.WithError(err).Fatal("cannot open new terminal")
		}

		if terminalNewOpts.Detach {
			fmt.Println(resp.Alias)
			return
		}

		attachToTerminal(context.Background(), client, resp.Alias, attachToTerminalOpts{
			Interactive: true,
			Token:       resp.StarterToken,
		})
	},
}

func init() {
	terminalCmd.AddCommand(terminalNewCmd)

	terminalNewCmd.Flags().BoolVarP(&terminalNewOpts.Detach, "detach", "d", false, "don't attach to the new terminal")
}
