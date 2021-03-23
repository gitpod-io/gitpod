// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"io"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager-bridge/api"
)

// clustersDeregisterCmd represents the clustersDeregisterCmd command
var clustersDeregisterCmd = &cobra.Command{
	Use:   "deregister [cluster name]",
	Short: "Deregister a cluster",
	Long:  "Deregisters the cluster [cluster name].",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getClustersClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		name := args[0]

		_, err = client.Deregister(ctx, &api.DeregisterRequest{Name: name})
		if err != nil && err != io.EOF {
			log.Fatal(err)
		}

		fmt.Printf("cluster '%s' deregistered\n", name)
	},
}

func init() {
	clustersCmd.AddCommand(clustersDeregisterCmd)
}
