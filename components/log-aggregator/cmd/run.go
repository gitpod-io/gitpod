// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/gitpod-io/gitpod/log-aggregator/api"
	"github.com/gitpod-io/gitpod/log-aggregator/pkg/aggregator"

	grpcruntime "github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
)

// runCmd represents the run command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts the log-aggregator service",
	Run: func(cmd *cobra.Command, args []string) {
		cfg := getConfig()

		common_grpc.SetupLogging()
		var promreg prometheus.Registerer
		if cfg.Prometheus.Addr != "" {
			reg := prometheus.NewRegistry()
			promreg = reg

			handler := http.NewServeMux()
			handler.Handle("/metrics", promhttp.HandlerFor(reg, promhttp.HandlerOpts{}))

			// BEWARE: for the gRPC client side metrics to work it's important to call common_grpc.ClientMetrics()
			//         before NewOrchestratingBuilder as the latter produces the gRPC client.
			reg.MustRegister(
				collectors.NewGoCollector(),
				collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
				common_grpc.ClientMetrics(),
			)

			go func() {
				err := http.ListenAndServe(cfg.Prometheus.Addr, handler)
				if err != nil {
					log.WithError(err).Error("Prometheus metrics server failed")
				}
			}()
			log.WithField("addr", cfg.Prometheus.Addr).Info("started Prometheus metrics server")
		}

		if cfg.PProf.Addr != "" {
			go pprof.Serve(cfg.PProf.Addr)
		}

		if promreg != nil {
			// err := service.RegisterMetrics(promreg)
			// if err != nil {
			// 	log.Fatal(err)
			// }
		}

		agg, err := aggregator.New(&cfg.Configuration)
		if err != nil {
			log.Fatal(err)
		}

		aggl, err := net.Listen("tcp", cfg.AggregatorAddr)
		if err != nil {
			log.Fatal(err)
		}
		srv := grpc.NewServer()
		api.RegisterAggregatorServer(srv, agg)
		go srv.Serve(aggl)

		ignl, err := net.Listen("tcp", cfg.IngesterAddr)
		if err != nil {
			log.Fatal(err)
		}
		restMux := grpcruntime.NewServeMux()
		err = api.RegisterIngesterHandlerServer(context.TODO(), restMux, agg)
		if err != nil {
			log.Fatal(err)
		}
		go http.Serve(ignl, restMux)

		// run until we're told to stop
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		log.Info("👷 log-aggregator is up and running. Stop with SIGINT or CTRL+C")
		<-sigChan
		log.Info("Received SIGINT - shutting down")
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}
