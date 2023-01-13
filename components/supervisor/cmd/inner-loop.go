// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/gitpod-io/gitpod/common-go/log"
	daemonapi "github.com/gitpod-io/gitpod/ws-daemon/api"
)

var innerLoopOpts struct {
	Headless bool
}

var innerLoopCmd = &cobra.Command{
	Use:   "inner-loop",
	Short: "innerLoop Test",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
		defer cancel()

		log.Init(ServiceName, Version, false, false)

		const socketFN = "/.supervisor/debug-service.sock"

		conn, err := grpc.DialContext(ctx, "unix://"+socketFN, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			log.WithError(err).Fatal("could not dial context")
		}
		defer conn.Close()

		client := daemonapi.NewDebugServiceClient(conn)
		resp, err := client.Start(context.Background(), &daemonapi.StartRequest{})
		if err != nil {
			log.WithError(err).Fatal("could not retrieve workspace info")
		}
		for {
			data, err := resp.Recv()
			if err == io.EOF {
				break
			}
			if err != nil {
				log.WithError(err).Fatal("recv err")
			}
			fmt.Printf("%+v\n", data)
		}
	},
}

func init() {
	rootCmd.AddCommand(innerLoopCmd)
	innerLoopCmd.Flags().BoolVar(&innerLoopOpts.Headless, "headless", false, "running debug workspace in headless mode")
}
