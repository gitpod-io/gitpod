// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/workspace-rollout-job/pkg/analysis"
	"github.com/gitpod-io/gitpod/workspace-rollout-job/pkg/rollout"
	"github.com/gitpod-io/gitpod/workspace-rollout-job/pkg/wsbridge"
	"github.com/spf13/cobra"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
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
			log.Fatal("cannot get old cluster name. Please set using OLD_CLUSTER environment variable.")
		}

		new, presence := os.LookupEnv("NEW_CLUSTER")
		if !presence {
			log.Fatal("cannot get new cluster name. Please set using NEW_CLUSTER environment variable.")
		}

		// Get kubeconfig
		config, err := getKubeConfig()
		if err != nil {
			log.WithError(err).Fatal("failed to retrieve kube config")
		}

		version := "v0.1.0"
		serverOpts := []baseserver.Option{
			baseserver.WithVersion(version),
		}

		srv, err := baseserver.New("workspace-rollout-job", serverOpts...)
		if err != nil {
			log.WithError(err).Fatal("failed to initialize server")
			return
		}

		// Run in a separate routine as this is not the main purpose
		go srv.ListenAndServe()
		if err != nil {
			log.WithError(err).Fatal("failed to listen and serve")
			return
		}

		rollout.RegisterMetrics(srv.MetricsRegistry())

		// 30304 is the port where ws-manager-bridge will be accessible
		wsManagerBridgeClient, err := wsbridge.NewWsManagerBridgeClient(context.Background(), config, 30304)
		if err != nil {
			log.WithError(err).Fatal("failed to create a ws-manager-bridge client")
			return
		}

		// Check if the old cluster has a 100 score.
		if score, err := wsManagerBridgeClient.GetScore(ctx, old); err != nil || score != 100 {
			log.WithError(err).Fatal("init condition does not satisfy")
		}

		// Check if the new cluster has a 0 zero score.
		// TODO: Check if the new cluster has no constraints.
		if score, err := wsManagerBridgeClient.GetScore(ctx, new); err != nil || score != 0 {
			log.WithError(err).Fatal("init condition does not satisfy")
		}

		prometheusResource, presence := os.LookupEnv("PROMETHEUS_RESOURCE")
		if !presence {
			log.Fatal("cannot get prometheus resource. Please set using PROMETHEUS_RESOURCE environment variable in the format <namespace>/<kind>/<name>.")
		}

		// Start the rollout process
		prometheusAnalyzer, err := analysis.NewPrometheusAnalyzer(ctx, config, prometheusResource, 30305)
		if err != nil {
			log.WithError(err).Fatal("failed to create a prometheus client")
			return
		}

		job := rollout.New(old, new, 20*time.Second, 1*time.Second, 10, prometheusAnalyzer, wsManagerBridgeClient)
		job.Start(ctx)
	},
}

func getKubeConfig() (*rest.Config, error) {
	var config *rest.Config
	config, err := rest.InClusterConfig()
	if err != nil {
		kubeConfig := clientcmd.NewDefaultClientConfigLoadingRules().GetDefaultFilename()
		config, err = clientcmd.BuildConfigFromFlags("", kubeConfig)
		if err != nil {
			return nil, err
		}
	}
	return config, nil
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
