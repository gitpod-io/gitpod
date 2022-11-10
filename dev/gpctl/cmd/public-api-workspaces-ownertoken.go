// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/spf13/cobra"
)

var publicApiWorkspacesOwnertokenCmd = &cobra.Command{
	Use:   "ownertoken <workspace-id>",
	Short: "Retrieve the owner token for a given workspace ID",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		workspaceID := args[0]

		conn, err := newPublicAPIConn()
		if err != nil {
			log.WithError(err).Fatal()
		}

		service := v1.NewWorkspacesServiceClient(conn)

		log.Debugf("Retrieving workspace owner token for %s", workspaceID)
		resp, err := service.GetOwnerToken(cmd.Context(), &v1.GetOwnerTokenRequest{WorkspaceId: workspaceID})
		if err != nil {
			log.WithError(err).Fatalf("failed to retrieve owner token (ID: %s)", workspaceID)
			return
		}

		tpl := `{{ .Token }}`
		err = getOutputFormat(tpl, "{..token}").Print(resp)
		if err != nil {
			log.Fatal(err)
		}
	},
}

func init() {
	publicApiWorkspacesCmd.AddCommand(publicApiWorkspacesOwnertokenCmd)
}
