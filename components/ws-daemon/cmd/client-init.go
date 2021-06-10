// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"

	"github.com/alecthomas/repr"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/ws-daemon/api"
)

// clientInitCmd starts a new workspace
var clientInitCmd = &cobra.Command{
	Use:   "init <request.json>",
	Short: "initialize a workspace",
	Args:  cobra.ExactArgs(0),
	Run: func(cmd *cobra.Command, args []string) {
		// fc, err := os.ReadFile(args[0])
		// if err != nil {
		// 	log.WithError(err).Fatal("cannot read init request")
		// }

		// var initReq api.InitWorkspaceRequest
		// if err := json.Unmarshal(fc, &initReq); err != nil {
		// 	log.WithError(err).Fatal("cannot parse init request")
		// }

		initReq := api.InitWorkspaceRequest{
			Id: "foobar",
			Metadata: &api.WorkspaceMetadata{
				Owner:  "chris",
				MetaId: "foofoo",
			},
			Initializer: &csapi.WorkspaceInitializer{
				Spec: &csapi.WorkspaceInitializer_Git{
					Git: &csapi.GitInitializer{
						RemoteUri:        "https://github.com/32leaves/bel",
						TargetMode:       csapi.CloneTargetMode_REMOTE_HEAD,
						CheckoutLocation: "bel",
						Config: &csapi.GitConfig{
							Authentication: csapi.GitAuthMethod_NO_AUTH,
						},
					},
				},
			},
		}

		conn, err := getGRPCConnection()
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		client := api.NewWorkspaceContentServiceClient(conn)
		resp, err := client.InitWorkspace(context.Background(), &initReq)
		if err != nil {
			log.WithError(err).Fatal("error during RPC call")
		}

		repr.Println(resp)
	},
}

func init() {
	clientCmd.AddCommand(clientInitCmd)
	// clientInitCmd.Flags().BoolVar(&startWorkspaceReq.Headless, "headless", false, "start a headless workspace")
	// clientInitCmd.Flags().StringVarP(&startWorkspaceReq.ServicePrefix, "service-prefix", "p", "", "use a service prefix different from the workspace ID")
	// clientInitCmd.Flags().StringVar(&startWorkspaceReq.Metadata.Owner, "owner", "foobar", "set the workspace owner")
}
