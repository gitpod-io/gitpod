// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"os"
	"os/signal"
	"syscall"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/poolkeeper/pkg/poolkeeper"
)

var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts applying the configured NodePoolConfigs",

	Run: func(cmd *cobra.Command, args []string) {
		config := getConfig()
		if config == nil {
			log.Fatal("cannot read config")
		}

		clientSet, err := newClientSet()
		if err != nil {
			log.Fatal("cannot read kubeconfig")
		}
		defer func() {
			log.Info("poolkeeper stopped.")
		}()

		poolKeeper := poolkeeper.NewPoolKeeper(clientSet, &config.Poolkeeper)
		go poolKeeper.Start()
		defer poolKeeper.Stop()

		log.Info("🧹 poolkeeper is up and running. Stop with SIGINT or CTRL+C")

		// Run until we're told to stop
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		<-sigChan

		log.Info("stopping poolkeeper...")
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}
