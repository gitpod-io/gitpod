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

// clientResolveBaseimageCmd represents the clientResolveBaseimage command
var clientResolveBaseimageCmd = &cobra.Command{
	Use:   "base-image <ref>",
	Short: "Resolves a base image ref to an absolute ref",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getImagebuildsClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		auth := &builder.BuildRegistryAuth{
			Mode: &builder.BuildRegistryAuth_Total{
				Total: &builder.BuildRegistryAuthTotal{
					AllowAll: true,
				},
			},
		}

		resp, err := client.ResolveBaseImage(ctx, &builder.ResolveBaseImageRequest{
			Ref:  args[0],
			Auth: auth,
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
	imagebuildsResolveCmd.AddCommand(clientResolveBaseimageCmd)
}
