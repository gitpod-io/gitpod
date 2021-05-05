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

// clustersCordonCmd represents the clustersCordonCmd command
var clustersCordonCmd = &cobra.Command{
	Use:   "cordon --name [cluster name]",
	Short: "Cordon a cluster",
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getClustersClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		name := getClusterName()
		request := &api.UpdateRequest{Name: name, Property: &api.UpdateRequest_Cordoned{Cordoned: true}}
		_, err = client.Update(ctx, request)
		if err != nil && err != io.EOF {
			log.Fatal(err)
		}

		fmt.Printf("cluster '%s' cordoned\n", name)
	},
}

func init() {
	clustersCmd.AddCommand(clustersCordonCmd)
}
