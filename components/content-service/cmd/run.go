// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	grpc_opentracing "github.com/grpc-ecosystem/go-grpc-middleware/tracing/opentracing"
	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/keepalive"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/content-service/pkg/service"
)

// runCmd starts the content service
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts the content service",

	Run: func(cmd *cobra.Command, args []string) {
		cfg := getConfig()
		reg := prometheus.NewRegistry()

		grpcMetrics := grpc_prometheus.NewServerMetrics()
		grpcMetrics.EnableHandlingTimeHistogram()
		reg.MustRegister(grpcMetrics)

		grpcOpts := []grpc.ServerOption{
			// We don't know how good our cients are at closing connections. If they don't close them properly
			// we'll be leaking goroutines left and right. Closing Idle connections should prevent that.
			grpc.KeepaliveParams(keepalive.ServerParameters{MaxConnectionIdle: 30 * time.Minute}),
			grpc.StreamInterceptor(grpc_middleware.ChainStreamServer(
				grpcMetrics.StreamServerInterceptor(),
				grpc_opentracing.StreamServerInterceptor(grpc_opentracing.WithTracer(opentracing.GlobalTracer())),
			)),
			grpc.UnaryInterceptor(grpc_middleware.ChainUnaryServer(
				grpcMetrics.UnaryServerInterceptor(),
				grpc_opentracing.UnaryServerInterceptor(grpc_opentracing.WithTracer(opentracing.GlobalTracer())),
			)),
		}
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
		service, err := service.NewContentService(cfg.Storage)
		if err != nil {
			log.WithError(err).Fatalf("cannot create content service")
		}
		api.RegisterBlobServiceServer(server, service)
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
		log.WithField("addr", cfg.Service.Addr).Info("started gRPC server")

		if cfg.Prometheus.Addr != "" {
			reg.MustRegister(
				prometheus.NewGoCollector(),
				prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}),
			)

			handler := http.NewServeMux()
			handler.Handle("/metrics", promhttp.HandlerFor(reg, promhttp.HandlerOpts{}))

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

		if err != nil {
			log.WithError(err).Fatal("cannot start daemon")
		}

		// run until we're told to stop
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		log.Info("🧫 content-service is up and running. Stop with SIGINT or CTRL+C")
		<-sigChan
		server.Stop()
		log.Info("Received SIGINT - shutting down")
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}
