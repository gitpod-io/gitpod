// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
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

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/gitpod-io/gitpod/ws-manager-node/pkg/daemon"
	"github.com/gitpod-io/gitpod/ws-manager-node/pkg/protocol"

	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	grpc_opentracing "github.com/grpc-ecosystem/go-grpc-middleware/tracing/opentracing"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/spf13/cobra"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/keepalive"
)

// serveCmd represents the serve command
var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Connects to the messagebus and starts the workspace monitor",

	Run: func(cmd *cobra.Command, args []string) {
		cfg := getConfig()

		err := cfg.Daemon.Validate()
		if err != nil {
			log.WithError(err).Fatal("invalid configuration")
		}
		log.Info("wsman-node configuration is valid")

		reg := prometheus.NewRegistry()
		daemon, err := daemon.New(cfg.Daemon, reg)
		if err != nil {
			log.WithError(err).Fatal("cannot start daemon")
		}
		go daemon.Start()

		grpcOpts := []grpc.ServerOption{
			// We don't know how good our cients are at closing connections. If they don't close them properly
			// we'll be leaking goroutines left and right. Closing Idle connections should prevent that.
			grpc.KeepaliveParams(keepalive.ServerParameters{MaxConnectionIdle: 30 * time.Minute}),
			grpc.StreamInterceptor(grpc_middleware.ChainStreamServer(
				grpc_opentracing.StreamServerInterceptor(grpc_opentracing.WithTracer(opentracing.GlobalTracer())),
			)),
			grpc.UnaryInterceptor(grpc_middleware.ChainUnaryServer(
				grpc_opentracing.UnaryServerInterceptor(grpc_opentracing.WithTracer(opentracing.GlobalTracer())),
			)),
		}
		if cfg.TLS.Certificate != "" && cfg.TLS.PrivateKey != "" {
			creds, err := credentials.NewServerTLSFromFile(cfg.TLS.Certificate, cfg.TLS.PrivateKey)
			if err != nil {
				log.WithError(err).WithField("crt", cfg.TLS.Certificate).WithField("key", cfg.TLS.PrivateKey).Fatal("could not load TLS keys")
			}
			grpcOpts = append(grpcOpts, grpc.Creds(creds))
			log.WithField("crt", cfg.TLS.Certificate).WithField("key", cfg.TLS.PrivateKey).Debug("securing gRPC server with TLS")
		} else {
			log.Warn("no TLS configured - gRPC server will be unsecured")
		}

		grpcServer := grpc.NewServer(grpcOpts...)
		protocol.RegisterWorkspaceManagerNodeServer(grpcServer, daemon)
		lis, err := net.Listen("tcp", cfg.RPCServerAddr)
		if err != nil {
			log.WithError(err).WithField("addr", cfg.RPCServerAddr).Fatal("cannot start RPC server")
		}
		//nolint:errcheck
		go grpcServer.Serve(lis)
		log.WithField("addr", cfg.RPCServerAddr).Info("started gRPC server")

		if cfg.PProfAddr != "" {
			go pprof.Serve(cfg.PProfAddr)
		}

		if cfg.PrometheusAddr != "" {
			reg.MustRegister(
				prometheus.NewGoCollector(),
				prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{}),
			)

			handler := http.NewServeMux()
			handler.Handle("/metrics", promhttp.HandlerFor(reg, promhttp.HandlerOpts{}))

			go func() {
				err := http.ListenAndServe(cfg.PrometheusAddr, handler)
				if err != nil {
					log.WithError(err).Error("Prometheus metrics server failed")
				}
			}()
			log.WithField("addr", cfg.PrometheusAddr).Info("started Prometheus metrics server")
		}

		// run until we're told to stop
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		log.Info("💁  wsman-node is up and running. Stop with SIGINT or CTRL+C")
		<-sigChan
		log.Info("Received SIGINT - shutting down")

		grpcServer.Stop()
		daemon.Close()
	},
}

func init() {
	rootCmd.AddCommand(runCmd)
}
