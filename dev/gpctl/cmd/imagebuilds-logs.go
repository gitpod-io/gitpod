// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"io"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	builder "github.com/gitpod-io/gitpod/image-builder/api"
)

var imagebuildsLogsCmd = &cobra.Command{
	Use:   "logs <build-ref>",
	Short: "Subscribes to the logs of an ongoing build",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getImagebuildsClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		// build did start, print log until done
		censor, _ := cmd.Flags().GetBool("censor")
		lc, err := client.Logs(ctx, &builder.LogsRequest{
			BuildRef: args[0],
			Censored: censor,
		})
		if err != nil && err != io.EOF {
			log.Fatal(err)
		}
		log.WithField("censor", censor).Info("listening for build logs")
		for {
			l, err := lc.Recv()
			if err == io.EOF {
				break
			}
			if err != nil {
				log.WithError(err).Fatal("recv err")
			}
			fmt.Print(string(l.Content))
		}
	},
}

func init() {
	imagebuildsCmd.AddCommand(imagebuildsLogsCmd)

	imagebuildsLogsCmd.Flags().Bool("censor", false, "censor the log output")
}
