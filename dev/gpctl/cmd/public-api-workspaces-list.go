// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
	"github.com/spf13/cobra"
)

var publicApiWorkspacesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List your workspaces",
	Run: func(cmd *cobra.Command, args []string) {
		conn, err := newPublicAPIConn()
		if err != nil {
			log.Log.WithError(err).Fatal()
		}

		service := v1.NewWorkspacesServiceClient(conn)

		resp, err := service.ListWorkspaces(cmd.Context(), &v1.ListWorkspacesRequest{})
		if err != nil {
			log.WithError(err).Fatal("failed to retrieve workspace list")
			return
		}

		tpl := `ID	Owner	ContextURL
{{- range .Result }}
{{ .Result.WorkspaceId }}	{{ .Result.OwnerId }}	{{ .Result.Context.ContextUrl }}
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
