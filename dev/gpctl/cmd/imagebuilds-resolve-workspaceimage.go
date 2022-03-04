// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	builder "github.com/gitpod-io/gitpod/image-builder/api"
)

var clientResolveWorkspaceImageCmd = &cobra.Command{
	Use:   "workspace-image <base-image-ref>",
	Short: "Resolves the workspace-image for a ref-based build source",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getImagebuildsClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		resp, err := client.ResolveWorkspaceImage(ctx, &builder.ResolveWorkspaceImageRequest{
			Source: &builder.BuildSource{
				From: &builder.BuildSource_Ref{
					Ref: &builder.BuildSourceReference{
						Ref: args[0],
					},
				},
			},
		})

		if err != nil {
			log.WithError(err).Fatal("error during RPC call")
		}

		tpl := `{{ .Ref }}
`
		getOutputFormat(tpl, "{.ref}").Print(resp)
	},
}

func init() {
	imagebuildsResolveCmd.AddCommand(clientResolveWorkspaceImageCmd)
}
