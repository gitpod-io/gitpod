// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	"github.com/grpc-ecosystem/grpc-opentracing/go/otgrpc"
	"github.com/heptiolabs/healthcheck"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/config"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/daemon"
)

// serveCmd represents the serve command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Connects to the messagebus and starts the workspace monitor",

	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := config.Read(configFile)
		if err != nil {
			log.WithError(err).Fatal("cannot read configuration. Maybe missing --config?")
		}
		reg := prometheus.NewRegistry()
		dmn, err := daemon.NewDaemon(cfg.Daemon, prometheus.WrapRegistererWithPrefix("gitpod_ws_daemon_", reg))
		if err != nil {
			log.WithError(err).Fatal("cannot create daemon")
		}

		common_grpc.SetupLogging()

		grpcMetrics := grpc_prometheus.NewServerMetrics()
		grpcMetrics.EnableHandlingTimeHistogram()
		reg.MustRegister(grpcMetrics)

		grpcOpts := common_grpc.ServerOptionsWithInterceptors(
			[]grpc.StreamServerInterceptor{grpcMetrics.StreamServerInterceptor(), otgrpc.OpenTracingStreamServerInterceptor(opentracing.GlobalTracer())},
			[]grpc.UnaryServerInterceptor{grpcMetrics.UnaryServerInterceptor(), otgrpc.OpenTracingServerInterceptor(opentracing.GlobalTracer())},
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

		healthServer := health.NewServer()

		server := grpc.NewServer(grpcOpts...)
		server.RegisterService(&grpc_health_v1.Health_ServiceDesc, healthServer)

		dmn.Register(server)
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
				collectors.NewGoCollector(),
				collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
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

		if cfg.ReadinessProbeAddr != "" {
			// Ensure we can access the GRPC server is healthy, the etc hosts file was updated and containerd is available.
			health := healthcheck.NewHandler()
			health.AddReadinessCheck("grpc-server", grpcProbe(cfg.Service))
			health.AddReadinessCheck("ws-daemon", dmn.ReadinessProbe())

			go func() {
				if err := http.ListenAndServe(cfg.ReadinessProbeAddr, health); err != nil && err != http.ErrServerClosed {
					log.WithError(err).Panic("error starting HTTP server")
				}
			}()
		}

		err = dmn.Start()
		if err != nil {
			log.WithError(err).Fatal("cannot start daemon")
		}

		go config.Watch(configFile, dmn.ReloadConfig)

		// run until we're told to stop
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		log.Info("🧫 ws-daemon is up and running. Stop with SIGINT or CTRL+C")
		<-sigChan
		server.Stop()
		err = dmn.Stop()
		if err != nil {
			log.WithError(err).Error("cannot shut down gracefully")
		}
		log.Info("Received SIGINT - shutting down")
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}

func grpcProbe(tlsConfig config.AddrTLS) func() error {
	return func() error {
		secopt := grpc.WithInsecure()
		if tlsConfig.TLS != nil && tlsConfig.TLS.Certificate != "" {
			tlsConfig, err := common_grpc.ClientAuthTLSConfig(
				tlsConfig.TLS.Authority, tlsConfig.TLS.Certificate, tlsConfig.TLS.PrivateKey,
				common_grpc.WithSetRootCAs(true),
				common_grpc.WithServerName("wsdaemon"),
			)
			if err != nil {
				return xerrors.Errorf("cannot load ws-daemon certificate: %w", err)
			}

			secopt = grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig))
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		conn, err := grpc.DialContext(ctx, tlsConfig.Addr, secopt)
		if err != nil {
			return err
		}
		defer conn.Close()

		client := grpc_health_v1.NewHealthClient(conn)
		check, err := client.Check(ctx, &grpc_health_v1.HealthCheckRequest{})
		if err != nil {
			return err
		}

		if check.Status == grpc_health_v1.HealthCheckResponse_SERVING {
			return nil
		}

		return fmt.Errorf("grpc service not ready")
	}
}
