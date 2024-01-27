// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/v1"
	"github.com/spf13/cobra"
)

var publicApiWorkspacesListCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List your workspaces",
	Args:    cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		organizationID := args[0]

		conn, err := newPublicAPIConn()
		if err != nil {
			log.Log.WithError(err).Fatal()
		}

		service := v1.NewWorkspaceServiceClient(conn)

		resp, err := service.ListWorkspaces(cmd.Context(), &v1.ListWorkspacesRequest{OrganizationId: organizationID})
		if err != nil {
			log.WithError(err).Fatal("failed to retrieve workspace list")
			return
		}

		tpl := `ID	OrganizationID	ContextURL	InstanceID	InstanceStatus
{{- range .Workspaces }}
{{ .Id }}	{{ .OrganizationId }}	{{ .ContextUrl }}	{{ .Status.InstanceId }}	{{ .Status.Phase.Name }}
{{ end }}
`
		err = getOutputFormat(tpl, "{..id}").Print(resp)
		if err != nil {
			log.Fatal(err)
		}
	},
}

func init() {
	publicApiWorkspacesCmd.AddCommand(publicApiWorkspacesListCmd)
}
