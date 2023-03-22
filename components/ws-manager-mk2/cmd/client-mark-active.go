// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

// clientInitCmd starts a new workspace
var clientMarkActiveCmd = &cobra.Command{
	Use:  "mark-active",
	Args: cobra.ExactArgs(0),
	Run: func(cmd *cobra.Command, args []string) {
		// fc, err := os.ReadFile(args[0])
		// if err != nil {
		// 	log.WithError(err).Fatal("cannot read init request")
		// }

		// var initReq api.InitWorkspaceRequest
		// if err := json.Unmarshal(fc, &initReq); err != nil {
		// 	log.WithError(err).Fatal("cannot parse init request")
		// }

		initReq := api.MarkActiveRequest{
			Id: "foobar",
		}

		conn, err := getGRPCConnection()
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		client := api.NewWorkspaceManagerClient(conn)
		ctx, _ := context.WithDeadline(cmd.Context(), time.Now().Add(1*time.Second))
		resp, err := client.MarkActive(ctx, &initReq)
		if err != nil {
			log.WithError(err).Fatal("error during RPC call")
		}
		fmt.Println(resp)
	},
}

func init() {
	clientCmd.AddCommand(clientMarkActiveCmd)
	// clientInitCmd.Flags().StringVarP(&startWorkspaceReq.ServicePrefix, "service-prefix", "p", "", "use a service prefix different from the workspace ID")
	// clientInitCmd.Flags().StringVar(&startWorkspaceReq.Metadata.Owner, "owner", "foobar", "set the workspace owner")
}
