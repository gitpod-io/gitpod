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

const (
	version string = "0.0.0"
)

type config struct {
	oldCluster               string
	newCluster               string
	prometheusURL            string
	rollOutWaitDuration      time.Duration
	analsysWaitDuration      time.Duration
	rolloutStepScore         int32
	okayScoreUntilNoData     int32
	targetPositivePercentage int
}

var (
	conf config
)

var rootCmd = &cobra.Command{
	Short: "Rollout from old to a new cluster while monitoring metrics",
	RunE: func(cmd *cobra.Command, args []string) error {
		log.Info("Starting workspace-rollout-job")
		ctx := context.Background()
		var err error

		if conf.rolloutStepScore <= 0 {
			return fmt.Errorf("rollout step score must be greater than 0")
		}

		// Get kubeconfig
		config, err := getKubeConfig()
		if err != nil {
			log.WithError(err).Fatal("failed to retrieve kube config")
			return err
		}

		serverOpts := []baseserver.Option{
			baseserver.WithVersion(version),
		}

		srv, err := baseserver.New("workspace-rollout-job", serverOpts...)
		if err != nil {
			log.WithError(err).Fatal("failed to initialize server")
			return err
		}

		// Run in a separate routine as this is not the main purpose
		// This is used to expose prometheus metrics
		go func() {
			err = srv.ListenAndServe()
			if err != nil {
				log.WithError(err).Fatal("failed to listen and serve")
				os.Exit(1)
			}
		}()

		rollout.RegisterMetrics(srv.MetricsRegistry())

		// 30304 is the port where ws-manager-bridge will be accessible
		wsManagerBridgeClient, err := wsbridge.NewWsManagerBridgeClient(context.Background(), config, 30304)
		if err != nil {
			log.WithError(err).Fatal("failed to create a ws-manager-bridge client")
			return err
		}

		// Check if the old cluster has a 100 score.
		if score, err := wsManagerBridgeClient.GetScore(ctx, conf.oldCluster); err != nil || score != 100 {
			log.WithError(err).Fatal("init condition does not satisfy")
			return err
		}

		// Check if the new cluster has a 0 zero score.
		// TODO: Check if the new cluster has no constraints.
		if score, err := wsManagerBridgeClient.GetScore(ctx, conf.newCluster); err != nil || score != 0 {
			log.WithError(err).Fatal("init condition does not satisfy")
			return err
		}

		prometheusAnalyzer, err := analysis.NewWorkspaceKeyMetricsAnalyzer(ctx, config, conf.prometheusURL, conf.targetPositivePercentage, 30305)
		if err != nil {
			log.WithError(err).Fatal("failed to create a prometheus client")
			return err
		}

		job := rollout.New(conf.oldCluster, conf.newCluster, conf.rollOutWaitDuration, conf.analsysWaitDuration, conf.rolloutStepScore, conf.okayScoreUntilNoData, prometheusAnalyzer, wsManagerBridgeClient)
		return job.Start(ctx)
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
	rootCmd.Flags().StringVar(&conf.oldCluster, "old-cluster", "", "Name of the old cluster with score 100")
	rootCmd.Flags().StringVar(&conf.newCluster, "new-cluster", "", "Name of the new cluster with score 0")
	rootCmd.Flags().StringVar(&conf.prometheusURL, "prometheus-url", "", "URL of Prometheus Service")
	rootCmd.Flags().DurationVar(&conf.rollOutWaitDuration, "rollout-wait-duration", 50*time.Second, "Duration to wait before updating the score of the new cluster")
	rootCmd.Flags().DurationVar(&conf.analsysWaitDuration, "analysis-wait-duration", 1*time.Second, "Duration to wait before analyzing the metrics")
	rootCmd.Flags().Int32Var(&conf.rolloutStepScore, "rollout-step-score", 10, "Score to be added to the new cluster, and decreased from the old cluster")
	rootCmd.Flags().Int32Var(&conf.okayScoreUntilNoData, "okay-score-until-no-data", 60, "If the score is below this value, and there is no data, the rollout score will be considered okay")
	rootCmd.Flags().IntVar(&conf.targetPositivePercentage, "target-positive-percentage", 95, "Target percentage of positive metrics")

	rootCmd.MarkFlagRequired("old-cluster")
	rootCmd.MarkFlagRequired("new-cluster")
	rootCmd.MarkFlagRequired("prometheus-url")
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
