// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"io"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager-bridge/api"
)

// clustersListCmd represents the clustersListCmd command
var clustersListCmd = &cobra.Command{
	Use:   "list",
	Short: "Lists all clusters",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getClustersClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		resp, err := client.List(ctx, &api.ListRequest{})
		if err != nil && err != io.EOF {
			log.Fatal(err)
		}

		tpl := `NAME	URL	STATE	SCORE	MAX_SCORE	GOVERNED
{{- range .Status }}
{{ .Name }}	{{ .Url }}	{{ .State }}	{{ .Score }}	{{ .MaxScore }}	{{ .Governed -}}
{{ end }}
`
		getOutputFormat(tpl, "{..name}").Print(resp)
	},
}

func init() {
	clustersCmd.AddCommand(clustersListCmd)
}
