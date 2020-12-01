// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cmd

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/gitpod-io/gitpod/ws-scheduler/pkg/scaler"
	"github.com/gitpod-io/gitpod/ws-scheduler/pkg/scheduler"
)

var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts listening to the kubernetes api and schedule detected pods",

	Run: func(cmd *cobra.Command, args []string) {
		config := getConfig()

		err := config.Scheduler.Validate()
		if err != nil {
			log.WithError(err).Fatal("invalid configuration")
		}

		clientSet, err := newClientSet()
		if err != nil {
			log.WithError(err).Fatal("cannot connect to Kubernetes")
		}
		log.Info("connected to Kubernetes")

		scheduler := scheduler.NewScheduler(config.Scheduler, clientSet)
		schedulerCtx, cancelScheduler := context.WithCancel(context.Background())
		err = scheduler.Start(schedulerCtx)
		if err != nil {
			log.WithError(err).Fatal("cannot start scheduler")
			cancelScheduler()
			return
		}
		defer func() {
			log.Info("ws-scheduler interrupted; shutting down...")
			cancelScheduler()
			scheduler.WaitForShutdown()
			log.Info("ws-scheduler shut down")
		}()
		log.Info("ws-scheduler is up and running. Stop with SIGINT or CTRL+C")

		if config.Scaler != nil {
			scaler := scaler.NewScaler(*config.Scaler, clientSet)
			scalerCtx, cancelScaler := context.WithCancel(context.Background())
			scaler.Start(scalerCtx)

			defer func() {
				log.Info("ws-scaler interrupted; shutting down...")
				cancelScaler()
				scaler.WaitForShutdown()
				log.Info("ws-scaler shut down")
			}()
			log.Info("ws-scaler is up and running. Stop with SIGINT or CTRL+C")
		}

		if config.Prometheus.Addr != "" {
			reg := prometheus.NewRegistry()
			reg.MustRegister(
				prometheus.NewGoCollector(),
				prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}),
			)

			handler := http.NewServeMux()
			handler.Handle("/metrics", promhttp.HandlerFor(reg, promhttp.HandlerOpts{}))

			go func() {
				err := http.ListenAndServe(config.Prometheus.Addr, handler)
				if err != nil {
					log.WithError(err).Error("Prometheus metrics server failed")
				}
			}()
			log.WithField("addr", config.Prometheus.Addr).Info("started Prometheus metrics server")
		}

		if config.PProf.Addr != "" {
			go pprof.Serve(config.PProf.Addr)
		}

		// Run until we're told to stop
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		<-sigChan

		// Defers from above executed here
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}
