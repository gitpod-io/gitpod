// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

// clientInitCmd starts a new workspace
var clientDescribeWorkspaceCmd = &cobra.Command{
	Use:  "describe",
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

		req := api.DescribeWorkspaceRequest{
			Id: wsId,
		}

		conn, err := getGRPCConnection()
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		client := api.NewWorkspaceManagerClient(conn)

		resp, err := client.DescribeWorkspace(cmd.Context(), &req)
		if err != nil {
			log.WithError(err).Fatal("error during RPC call")
		}
		fmt.Println(resp)
	},
}

func init() {
	clientCmd.AddCommand(clientDescribeWorkspaceCmd)
	clientDescribeWorkspaceCmd.Flags().StringVarP(&wsId, "id", "", "", "workspace id")
	// clientInitCmd.Flags().StringVarP(&startWorkspaceReq.ServicePrefix, "service-prefix", "p", "", "use a service prefix different from the workspace ID")
	// clientInitCmd.Flags().StringVar(&startWorkspaceReq.Metadata.Owner, "owner", "foobar", "set the workspace owner")
}
