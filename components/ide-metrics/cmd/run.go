// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"net/http"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ide-metrics-api/config"
	"github.com/gitpod-io/gitpod/ide-metrics/pkg/server"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(runCommand)
}

var runCommand = &cobra.Command{
	Use:     "run",
	Short:   "Starts the service",
	Version: Version,
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := config.Read(rootOpts.CfgFile)
		if err != nil {
			log.WithError(err).Fatal("cannot read configuration")
		}
		serviceRegistry := prometheus.NewRegistry()
		metricsRegistry := prometheus.NewRegistry()
		s := server.NewMetricsServer(cfg, serviceRegistry, metricsRegistry)

		handler := http.NewServeMux()
		handler.Handle("/metrics", promhttp.HandlerFor(prometheus.Gatherers{metricsRegistry, serviceRegistry}, promhttp.HandlerOpts{}))

		go func() {
			err := http.ListenAndServe(cfg.Prometheus.Addr, handler)
			if err != nil {
				log.WithError(err).Fatal("prometheus metrics server failed")
			}
		}()
		log.WithField("addr", cfg.Prometheus.Addr).Info("started prometheus metrics server")

		if err := s.Start(); err != nil {
			log.WithError(err).Fatal("cannot start server")
		}
	},
}
