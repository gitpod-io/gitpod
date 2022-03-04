// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/kedge/pkg/kedge"
	"github.com/spf13/cobra"
)

// collectCmd represents the collect command
var collectCmd = &cobra.Command{
	Use:   "collect",
	Short: "Collects and installs services from a kedge endpoint",
	Args:  cobra.ArbitraryArgs,
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := getConfig()
		if err != nil {
			log.WithError(err).Fatal("cannot get config")
		}

		clientset, err := kedge.NewClientSet(cfg.Kubeconfig)
		if err != nil {
			log.WithError(err).Fatal("cannot connect to kubernetes")
		}

		collectoridx := make(map[string]bool)
		for _, s := range args {
			collectoridx[s] = true
		}
		period := time.Duration(cfg.Collection.Period) * time.Second
		ticker := time.NewTicker(period)
		go func() {
			for ; true; <-ticker.C {
				for _, collector := range cfg.Collection.StaticCollection {
					if _, ok := collectoridx[collector.Name]; !ok && len(args) > 0 {
						continue
					}

					if collector.Token == "" {
						collector.Token = cfg.Token
					}

					if _, err := collector.CollectAndInstall(clientset, cfg.Namespace); err != nil {
						log.WithError(err).Fatal("error while replicating service endpoints")
					}
				}
			}
		}()

		log.WithField("period", period).WithField("activity", "collect").Info("kedge collect is up and running")

		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		<-sigChan
	},
}

func init() {
	rootCmd.AddCommand(collectCmd)
}
