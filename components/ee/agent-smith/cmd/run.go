// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/config"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/agent"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/spf13/cobra"
)

// runCmd represents the run command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts agent smith",
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := config.GetConfig(cfgFile)
		if err != nil {
			log.WithError(err).Fatal("cannot get config")
		}

		if cfg.PProfAddr != "" {
			go pprof.Serve(cfg.PProfAddr)
		}

		reg := prometheus.DefaultRegisterer
		if cfg.PrometheusAddr != "" {
			handler := http.NewServeMux()
			handler.Handle("/metrics", promhttp.Handler())

			go func() {
				err := http.ListenAndServe(cfg.PrometheusAddr, handler)
				if err != nil {
					log.WithError(err).Error("Prometheus metrics server failed")
				}
			}()
			log.WithField("addr", cfg.PrometheusAddr).Info("started Prometheus metrics server")
		}

		smith, err := agent.NewAgentSmith(cfg.Config)
		if err != nil {
			log.WithError(err).Fatal("cannot create agent smith")
		}

		err = reg.Register(smith)
		if err != nil {
			log.WithError(err).Fatal("cannot register metrics")
		}

		ctx := context.Background()
		ctx, cancel := context.WithCancel(ctx)
		defer cancel()

		go smith.Start(ctx, func(violation agent.InfringingWorkspace, penalties []config.PenaltyKind) {
			log.WithField("violation", violation).WithField("penalties", penalties).Info("Found violation")
		})

		if cfg.MaxSysMemMib > 0 {
			go startMemoryWatchdog(cfg.MaxSysMemMib)
		}

		log.WithField("namespace", cfg.Namespace).Info("agent smith is up and running")

		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

		select {
		case <-ctx.Done():
			return
		case <-sigChan:
			return
		}
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}

func startMemoryWatchdog(maxSysMemMib uint64) {
	t := time.NewTicker(30 * time.Second)
	var m runtime.MemStats
	for {
		runtime.ReadMemStats(&m)

		sysMemMib := m.Sys / 1024 / 1024
		if sysMemMib > maxSysMemMib {
			log.WithField("sysMemMib", sysMemMib).WithField("maxSysMemMib", maxSysMemMib).Fatal("reached maxmimum memory use - stopping")
		}

		<-t.C
	}
}
