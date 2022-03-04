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

// clustersSwapCmd represents the clustersSwapCmd command
var clustersSwapCmd = &cobra.Command{
	Use:   "swap [source cluster] [target cluster]",
	Short: "Swaps the status and score of two clusters",
	Long:  "Swaps the status and score of two clusters. Beware: this is not an atomic operation.",
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		conn, client, err := getClustersClient(ctx)
		if err != nil {
			log.WithError(err).Fatal("cannot connect")
		}
		defer conn.Close()

		resp, err := client.List(ctx, &api.ListRequest{})
		if err != nil {
			log.Fatal(err)
		}
		var (
			src *api.ClusterStatus
			dst *api.ClusterStatus
		)
		for _, c := range resp.Status {
			if c.Name == args[0] {
				src = c
			}
			if c.Name == args[1] {
				dst = c
			}
		}
		if src == nil {
			log.Fatalf("source cluster \"%s\" not found", args[0])
		}
		if dst == nil {
			log.Fatalf("destination cluster \"%s\" not found", args[1])
		}
		if ignore, _ := cmd.Flags().GetBool("ignore-admission-constraints"); !ignore {
			if len(src.AdmissionConstraint) > 0 || len(dst.AdmissionConstraint) > 0 {
				log.Fatal("one of the clusters has admission constraints. Swapping their state/score is unlikely to have the desired effect. If you want to swap nonetheless, please remove the constraints or run with --ignore-admission-constraints")
			}
		}
		if !src.Governed || !dst.Governed {
			log.Fatal("can only swap goverened cluster")
		}
		if src.Static || dst.Static {
			log.Fatal("can only swap non-static cluster")
		}

		reqs := []*api.UpdateRequest{
			{Name: dst.Name, Property: &api.UpdateRequest_Cordoned{Cordoned: src.State == api.ClusterState_CORDONED}},
			{Name: dst.Name, Property: &api.UpdateRequest_Score{Score: src.Score}},
			{Name: src.Name, Property: &api.UpdateRequest_Cordoned{Cordoned: dst.State == api.ClusterState_CORDONED}},
			{Name: src.Name, Property: &api.UpdateRequest_Score{Score: dst.Score}},
		}
		for _, r := range reqs {
			_, err = client.Update(ctx, r)
			if err != nil && err != io.EOF {
				log.Fatal(err)
			}
		}

		fmt.Printf("updated '%s' to score=%d,cordoned=%v and %s to score=%d,cordoned=%v \n", src.Name, dst.Score, dst.State == api.ClusterState_CORDONED, dst.Name, src.Score, src.State == api.ClusterState_CORDONED)
	},
}

func init() {
	clustersCmd.AddCommand(clustersSwapCmd)
	clustersSwapCmd.Flags().Bool("ignore-admission-constraints", false, "swap despite existing admission constraints")
}
