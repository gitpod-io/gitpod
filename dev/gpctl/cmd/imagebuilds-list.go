// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"io"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	builder "github.com/gitpod-io/gitpod/image-builder/api"
)

// clientLogsCmd represents the clientLogs command
var imagebuildsListCmd = &cobra.Command{
	Use:   "list",
	Short: "Lists all ongoing builds",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getImagebuildsClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		// build did start, print log until done
		resp, err := client.ListBuilds(ctx, &builder.ListBuildsRequest{})
		if err != nil && err != io.EOF {
			log.Fatal(err)
		}

		tpl := `REF	STATUS	STARTED AT
{{- range .Builds }}
{{ .Ref }}	{{ .Status }}	{{ .StartedAt }}
{{ end }}
`
		getOutputFormat(tpl, "{..ref}").Print(resp)
	},
}

func init() {
	imagebuildsCmd.AddCommand(imagebuildsListCmd)
}
