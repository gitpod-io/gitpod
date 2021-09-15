// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
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
	"github.com/spf13/cobra"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/gitpod-io/gitpod/ws-scheduler/pkg/scaler"
	sched "github.com/gitpod-io/gitpod/ws-scheduler/pkg/scheduler"
	schedMetrics "github.com/gitpod-io/gitpod/ws-scheduler/pkg/scheduler/metrics"
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

		reg := prometheus.NewRegistry()
		if config.Prometheus.Addr != "" {
			prometheus.WrapRegistererWithPrefix("gitpod_ws_scheduler_", reg).MustRegister(schedMetrics.AllMetrics...)
			reg.MustRegister(common_grpc.ClientMetrics())

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

		scheduler, err := sched.NewScheduler(config.Scheduler, clientSet)
		if err != nil {
			log.WithError(err).Fatal("cannot create scheduler")
		}
		schedulerCtx, cancelScheduler := context.WithCancel(context.Background())
		go func() {
			err = scheduler.Run(schedulerCtx)
			if err != nil {
				cancelScheduler()
				log.WithError(err).Fatal("cannot start scheduler")
			}
		}()
		defer func() {
			log.Info("ws-scheduler interrupted; shutting down...")
			cancelScheduler()
			scheduler.WaitForShutdown()
			log.Info("ws-scheduler shut down")
		}()

		if config.Scaler.Enabled {
			controller, err := scaler.NewController(config.Scaler.Controller)
			if err != nil {
				log.WithError(err).Fatal("cannot create scaler controller")
			}
			driver, err := scaler.NewWorkspaceManagerPrescaleDriver(config.Scaler.Driver, controller)
			if err != nil {
				log.WithError(err).Fatal("cannot create scaler driver")
			}
			err = driver.RegisterMetrics(prometheus.WrapRegistererWithPrefix("gitpod_ws_scaler_", reg))
			if err != nil {
				log.WithError(err).Fatal("cannot register metrics")
			}

			go driver.Run()
			defer driver.Stop()
			log.WithField("controller", config.Scaler.Controller.Kind).Info("started scaler")
		}

		log.Info("🗓️ ws-scheduler is up and running. Stop with SIGINT or CTRL+C")

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
