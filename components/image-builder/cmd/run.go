// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
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

	docker "github.com/docker/docker/client"
	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/gitpod-io/gitpod/image-builder/api"
	"github.com/gitpod-io/gitpod/image-builder/pkg/builder"
	"github.com/gitpod-io/gitpod/image-builder/pkg/resolve"
)

// runCmd represents the run command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Starts the image-builder service",
	Run: func(cmd *cobra.Command, args []string) {
		cfg := getConfig()

		if err := cfg.Builder.Validate(); err != nil {
			log.WithError(err).Fatal("builder configuration is invalid")
		}

		client, err := docker.NewClientWithOpts(docker.FromEnv)
		if err != nil {
			log.Fatal(err)
		}
		client.NegotiateAPIVersion(context.Background())

		_, err = client.ServerVersion(context.Background())
		if err != nil {
			log.Fatal(err)
		}

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		span, ctx := opentracing.StartSpanFromContext(ctx, "/cmd/Run")
		defer span.Finish()

		service := builder.NewDockerBuilder(&cfg.Builder, client)
		if cfg.Builder.DockerCfgFile != "" {
			auth, err := builder.NewDockerConfigFileAuth(cfg.Builder.DockerCfgFile)
			if err != nil {
				log.Fatal(err)
			}
			service.Auth = auth
		}
		if cfg.RefCache.Interval != "" && len(cfg.RefCache.Refs) > 0 {
			interval, err := time.ParseDuration(cfg.RefCache.Interval)
			if err != nil {
				log.WithError(err).WithField("interval", cfg.RefCache.Interval).Fatal("interval is not a valid duration")
			}

			resolver := &resolve.PrecachingRefResolver{
				Resolver: &resolve.DockerRegistryResolver{
					Client: client,
				},
				Candidates: cfg.RefCache.Refs,
			}
			go resolver.StartCaching(ctx, interval)
			service.Resolver = resolver
		}

		err = service.Start(ctx)
		if err != nil {
			log.Fatal(err)
		}

		grpcOpts := common_grpc.ServerOptionsWithInterceptors(
			[]grpc.StreamServerInterceptor{grpc_prometheus.StreamServerInterceptor},
			[]grpc.UnaryServerInterceptor{grpc_prometheus.UnaryServerInterceptor},
		)
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

		if cfg.Prometheus.Addr != "" {
			grpc_prometheus.EnableHandlingTimeHistogram()
			grpc_prometheus.Register(server)

			handler := http.NewServeMux()
			handler.Handle("/metrics", promhttp.Handler())

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
