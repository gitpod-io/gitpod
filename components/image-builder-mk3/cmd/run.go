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
	"time"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/gitpod-io/gitpod/image-builder/api"
	"github.com/gitpod-io/gitpod/image-builder/pkg/orchestrator"
	"github.com/gitpod-io/gitpod/image-builder/pkg/resolve"

	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
)

// runCmd represents the run command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts the image-builder service",
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

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		span, ctx := opentracing.StartSpanFromContext(ctx, "/cmd/Run")
		defer span.Finish()

		service, err := orchestrator.NewOrchestratingBuilder(cfg.Orchestrator)
		if err != nil {
			log.Fatal(err)
		}
		if cfg.RefCache.Interval != "" && len(cfg.RefCache.Refs) > 0 {
			interval, err := time.ParseDuration(cfg.RefCache.Interval)
			if err != nil {
				log.WithError(err).WithField("interval", cfg.RefCache.Interval).Fatal("interval is not a valid duration")
			}

			resolver := &resolve.PrecachingRefResolver{
				Resolver:   &resolve.StandaloneRefResolver{},
				Candidates: cfg.RefCache.Refs,
			}
			go resolver.StartCaching(ctx, interval)
			service.RefResolver = resolver
		}
		if promreg != nil {
			err = service.RegisterMetrics(promreg)
			if err != nil {
				log.Fatal(err)
			}
		}

		err = service.Start(ctx)
		if err != nil {
			log.Fatal(err)
		}

		grpcOpts := common_grpc.DefaultServerOptions()
		tlsOpt, err := cfg.Service.TLS.ServerOption()
		if err != nil {
			log.WithError(err).Fatal("cannot use TLS config")
		}
		if tlsOpt != nil {
			log.WithField("crt", cfg.Service.TLS.Certificate).WithField("key", cfg.Service.TLS.PrivateKey).Debug("securing gRPC server with TLS")
			grpcOpts = append(grpcOpts, tlsOpt)
		} else {
			log.Warn("no TLS configured - gRPC server will be unsecured")
		}

		server := grpc.NewServer(grpcOpts...)
		api.RegisterImageBuilderServer(server, service)
		lis, err := net.Listen("tcp", cfg.Service.Addr)
		if err != nil {
			log.WithError(err).Fatalf("cannot listen on %s", cfg.Service.Addr)
		}
		go func() {
			err := server.Serve(lis)
			if err != nil {
				log.WithError(err).Fatal("cannot start server")
			}
		}()
		log.WithField("addr", cfg.Service.Addr).Info("started workspace content server")

		// run until we're told to stop
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		log.Info("👷 image-builder is up and running. Stop with SIGINT or CTRL+C")
		<-sigChan
		server.Stop()
		// service.Stop()
		log.Info("Received SIGINT - shutting down")
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}
