package cmd

import (
	"context"
	"fmt"
	"os"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/spf13/cobra"
)

var terminalListCmd = &cobra.Command{
	Use:   "list",
	Short: "lists all of supervisor's terminals",
	Run: func(cmd *cobra.Command, args []string) {
		client := api.NewTerminalServiceClient(dialSupervisor())

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		resp, err := client.List(ctx, &api.ListTerminalsRequest{})
		if err != nil {
			log.WithError(err).Fatal("cannot list terminals")
		}

		tw := tabwriter.NewWriter(os.Stdout, 2, 4, 1, ' ', 0)
		defer tw.Flush()

		fmt.Fprintf(tw, "ALIAS\tCOMMAND\n")
		for _, term := range resp.Terminals {
			fmt.Fprintf(tw, "%s\t%s\n", term.Alias, strings.Join(term.Command, " "))
		}
	},
}

func init() {
	terminalCmd.AddCommand(terminalListCmd)
}
