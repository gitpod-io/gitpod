// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/v1"
	"github.com/spf13/cobra"
)

var publicApiWorkspacesGetCmd = &cobra.Command{
	Use:   "get <workspace-id>",
	Short: "Retrieve details about a workspace by ID",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		workspaceID := args[0]

		conn, err := newPublicAPIConn()
		if err != nil {
			log.Log.WithError(err).Fatal()
		}

		service := v1.NewWorkspaceServiceClient(conn)

		log.Log.Debugf("Retrieving workspace ID: %s", workspaceID)
		resp, err := service.GetWorkspace(cmd.Context(), &v1.GetWorkspaceRequest{WorkspaceId: workspaceID})
		if err != nil {
			log.WithError(err).Fatalf("failed to retrieve workspace (ID: %s)", workspaceID)
			return
		}

		tpl := `ID:	{{ .Workspace.Id }}
OrganizationID:	{{ .Workspace.OrganizationId }}
ContextURL:	{{ .Workspace.ContextUrl }}
InstanceID:	{{ .Workspace.Status.InstanceId }}
InstanceStatus:	{{ .Workspace.Status.Phase.Name }}
`
		err = getOutputFormat(tpl, "{..result.workspace_id}").Print(resp)
		if err != nil {
			log.Fatal(err)
		}
	},
}

func init() {
	publicApiWorkspacesCmd.AddCommand(publicApiWorkspacesGetCmd)
}
