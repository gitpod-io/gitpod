// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"sort"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/supervisor/api"
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

		fmt.Fprintf(tw, "ALIAS\tPID\tCOMMAND\tANNOTATIONS\n")
		for _, term := range resp.Terminals {
			annotations := make([]string, 0, len(term.Annotations))
			for k, v := range term.Annotations {
				annotations = append(annotations, fmt.Sprintf("%s=%s", k, v))
			}
			sort.Slice(annotations, func(i, j int) bool { return annotations[i] < annotations[j] })
			fmt.Fprintf(tw, "%s\t%d\t%s\t%s\n", term.Alias, term.Pid, strings.Join(term.Command, " "), strings.Join(annotations, ","))
		}
	},
}

func init() {
	terminalCmd.AddCommand(terminalListCmd)
}
