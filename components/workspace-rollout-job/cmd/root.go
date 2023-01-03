// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/workspace-rollout-job/pkg/analysis"
	"github.com/gitpod-io/gitpod/workspace-rollout-job/pkg/rollout"
	"github.com/gitpod-io/gitpod/workspace-rollout-job/pkg/wsbridge"
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "workspace-rollout-job",
	Short: "Rollout from old to a new cluster while monitoring metrics",
	Run: func(cmd *cobra.Command, args []string) {
		log.Info("Starting workspace-rollout-job")
		ctx := context.Background()
		var err error
		old, presence := os.LookupEnv("OLD_CLUSTER")
		if !presence {
			log.WithError(err).Fatal("cannot get old cluster")
		}

		new, presence := os.LookupEnv("NEW_CLUSTER")
		if !presence {
			log.WithError(err).Fatal("cannot get new cluster")
		}

		wsManagerBridgeClient := wsbridge.NewWsManagerBridgeClient("localhost:8080")
		// Check if the old cluster has a 100 score.
		if score, err := wsManagerBridgeClient.GetScore(ctx, old); err != nil || score != 100 {
			log.WithError(err).Fatal("init condition does not satisfy")
		}

		// Check if the new cluster has a 0 zero score.
		// TODO: Check if the new cluster has no constraints.
		if score, err := wsManagerBridgeClient.GetScore(ctx, new); err != nil || score != 0 {
			log.WithError(err).Fatal("init condition does not satisfy")
		}

		// Start the rollout process
		prometheusAnalyzer := analysis.NewPrometheusAnalyzer("http://localhost:9090")
		job := rollout.New(old, new, 20*time.Second, 1*time.Second, 10, prometheusAnalyzer, wsManagerBridgeClient)
		job.Start(ctx)
	},
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
