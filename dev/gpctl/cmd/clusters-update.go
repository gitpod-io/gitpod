// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"io"
	"strconv"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager-bridge/api"
)

// clustersUpdateCmd represents the clustersUpdateCmd command
var clustersUpdateCmd = &cobra.Command{
	Use:   "update [cluster name] [property] [value]",
	Short: "Update a cluster",
	Long:  "Updates the [property] (score, max_score, or crodoned) of the cluster [cluster name] with the new value [value].",
	Args:  cobra.ExactArgs(3),
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getClustersClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		name := args[0]

		var request *api.UpdateRequest
		switch args[1] {
		case "score":
			value, err := strconv.Atoi(args[2])
			if err != nil {
				log.Fatal(err)
			}
			request = &api.UpdateRequest{Name: name, Property: &api.UpdateRequest_Score{Score: int32(value)}}
		case "max_score":
			value, err := strconv.Atoi(args[2])
			if err != nil {
				log.Fatal(err)
			}
			request = &api.UpdateRequest{Name: name, Property: &api.UpdateRequest_MaxScore{MaxScore: int32(value)}}
		case "cordoned":
			value, err := strconv.ParseBool(args[2])
			if err != nil {
				log.Fatal(err)
			}
			request = &api.UpdateRequest{Name: name, Property: &api.UpdateRequest_Cordoned{Cordoned: value}}
		}

		_, err = client.Update(ctx, request)
		if err != nil && err != io.EOF {
			log.Fatal(err)
		}

		fmt.Printf("cluster '%s' updated with %s=%s\n", name, args[1], args[2])
	},
}

func init() {
	clustersCmd.AddCommand(clustersUpdateCmd)
}
