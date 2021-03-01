// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

// workspacesListCmd represents the describe command
var workspacesListCmd = &cobra.Command{
	Use:   "list",
	Short: "lists all workspaces",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getWorkspacesClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		resp, err := client.GetWorkspaces(ctx, &api.GetWorkspacesRequest{})
		if err != nil {
			log.WithError(err).Fatal("error during RPC call")
		}

		tpl := `OWNER	WORKSPACE	INSTANCE	PHASE
{{- range .Status }}
{{ .Metadata.Owner }}	{{ .Metadata.MetaId }}	{{ .Id }}	{{ .Phase -}}
{{ end }}
`
		err = getOutputFormat(tpl, "{..id}").Print(resp)
		if err != nil {
			log.Fatal(err)
		}
	},
}

func init() {
	workspacesCmd.AddCommand(workspacesListCmd)
}
