// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"context"
	"time"

	"github.com/heptiolabs/healthcheck"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/autoscaler-expander/pkg/config"
	"github.com/gitpod-io/gitpod/autoscaler-expander/pkg/expander"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/watch"
)

const grpcServerName = "autoscalerExpander"

// runCmd represents the run command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts cluster autoscaler expander server",
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := config.Read(configFile)
		if err != nil {
			log.WithError(err).Fatal("cannot get config")
		}

		health := healthcheck.NewHandler()
		srv, err := baseserver.New(grpcServerName,
			baseserver.WithGRPC(&cfg.Service),
			baseserver.WithHealthHandler(health),
		)
		if err != nil {
			log.WithError(err).Fatal("Cannot set up server.")
		}

		dmn, err := expander.NewAutoscalerExpander(cfg.Expander, prometheus.WrapRegistererWithPrefix("gitpod_autoscaler_expander_", srv.MetricsRegistry()))
		if err != nil {
			log.WithError(err).Fatal("Cannot create daemon.")
		}

		dmn.Register(srv.GRPC())

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		err = watch.File(ctx, configFile, func() {
			ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
			defer cancel()

			cfg, err := config.Read(configFile)
			if err != nil {
				log.WithError(err).Warn("Cannot reload configuration.")
				return
			}

			err = dmn.ReloadConfig(ctx, &cfg.Expander)
			if err != nil {
				log.WithError(err).Warn("Cannot reload configuration.")
			}
		})
		if err != nil {
			log.WithError(err).Fatal("Cannot start watch of configuration file.")
		}

		err = srv.ListenAndServe()
		if err != nil {
			log.WithError(err).Fatal("Failed to listen and serve.")
		}
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}
