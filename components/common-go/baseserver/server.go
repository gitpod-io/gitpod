// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package baseserver

import (
	"context"
	"fmt"
	gitpod_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	grpc_logrus "github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus"
	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health/grpc_health_v1"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
)

func New(name string, opts ...Option) (*Server, error) {
	cfg, err := evaluateOptions(defaultConfig(), opts...)
	if err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	server := &Server{
		Name: name,
		cfg:  cfg,
	}

	if initErr := server.initializeDebug(); initErr != nil {
		return nil, fmt.Errorf("failed to initialize debug server: %w", initErr)
	}

	if server.isHTTPEnabled() {
		httpErr := server.initializeHTTP()
		if httpErr != nil {
			return nil, fmt.Errorf("failed to initialize http server: %w", httpErr)
		}
	}

	if server.isGRPCEnabled() {
		grpcErr := server.initializeGRPC()
		if grpcErr != nil {
			return nil, fmt.Errorf("failed to initialize grpc server: %w", grpcErr)
		}
	}

	return server, nil
}

// Server is a packaged server with batteries included. It is designed to be standard across components where it makes sense.
// Server implements graceful shutdown making it suitable for usage in integration tests. See server_test.go.
//
// Server is composed of the following:
// 	* Debug server which serves observability and debug endpoints
//		- /metrics for Prometheus metrics
//		- /pprof for Golang profiler
//		- /ready for kubernetes readiness check
//		- /live for kubernetes liveness check
//	* (optional) gRPC server with standard interceptors and configuration
//		- Started when baseserver is configured WithGRPCPort (port is non-negative)
//		- Use Server.GRPC() to get access to the underlying grpc.Server and register services
//	* (optional) HTTP server
//		- Currently does not come with any standard HTTP middlewares
//		- Started when baseserver is configured WithHTTPPort (port is non-negative)
// 		- Use Server.HTTPMux() to get access to the root handler and register your endpoints
type Server struct {
	// Name is the name of this server, used for logging context
	Name string

	cfg *config

	// debug is an HTTP server for debug endpoints - metrics, pprof, readiness & liveness.
	debug         *http.Server
	debugListener net.Listener

	// http is an http Server, only used when port is specified in cfg
	http         *http.Server
	httpMux      *http.ServeMux
	httpListener net.Listener

	// grpc is a grpc Server, only used when port is specified in cfg
	grpc         *grpc.Server
	grpcListener net.Listener

	// listening indicates the server is serving. When closed, the server is in the process of graceful termination.
	listening chan struct{}
}

func (s *Server) ListenAndServe() error {
	var err error

	s.debugListener, err = net.Listen("tcp", fmt.Sprintf(":%d", s.cfg.debugPort))
	if err != nil {
		return fmt.Errorf("failed to acquire port %d", s.cfg.debugPort)
	}

	if s.isGRPCEnabled() {
		s.grpcListener, err = net.Listen("tcp", fmt.Sprintf(":%d", s.cfg.grpcPort))
		if err != nil {
			return fmt.Errorf("failed to acquire port %d", s.cfg.grpcPort)
		}
	}

	if s.isHTTPEnabled() {
		s.httpListener, err = net.Listen("tcp", fmt.Sprintf(":%d", s.cfg.httpPort))
		if err != nil {
			return fmt.Errorf("failed to acquire port %d", s.cfg.httpPort)
		}
	}

	errors := make(chan error)
	defer close(errors)
	s.listening = make(chan struct{})

	// Always start the debug server, we should always have metrics and other debug information.
	go func() {
		s.Logger().WithField("protocol", "http").Infof("Serving debug server on %s", s.debugListener.Addr().String())
		serveErr := s.debug.Serve(s.debugListener)
		if serveErr != nil {
			if s.isClosing() {
				return
			}

			errors <- serveErr
		}
	}()

	if s.isGRPCEnabled() {
		go func() {
			s.Logger().WithField("protocol", "grpc").Infof("Serving gRPC on %s", s.grpcListener.Addr().String())
			if serveErr := s.grpc.Serve(s.grpcListener); serveErr != nil {
				if s.isClosing() {
					return
				}

				errors <- serveErr
			}
		}()
	}

	if s.isHTTPEnabled() {
		go func() {
			s.Logger().WithField("protocol", "http").Infof("Serving http on %s", s.httpListener.Addr().String())
			if serveErr := s.http.Serve(s.httpListener); serveErr != nil {
				if s.isClosing() {
					return
				}

				errors <- serveErr
			}
		}()
	}

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)

	// Await operating system signals, or server errors.
	select {
	case sig := <-signals:
		s.Logger().Infof("Received system signal %s, closing server.", sig.String())
		if closeErr := s.Close(); closeErr != nil {
			s.Logger().WithError(closeErr).Error("Failed to close server.")
			return closeErr
		}

		return nil
	case serverErr := <-errors:
		s.Logger().WithError(serverErr).Errorf("Server encountered an error. Closing remaining servers.")
		if closeErr := s.Close(); closeErr != nil {
			return fmt.Errorf("failed to close server after one of the servers errored: %w", closeErr)
		}

		return serverErr
	}
}

func (s *Server) Close() error {
	ctx, cancel := context.WithTimeout(context.Background(), s.cfg.closeTimeout)
	defer cancel()

	return s.close(ctx)
}

func (s *Server) Logger() *logrus.Entry {
	return s.cfg.logger
}

// HTTPAddress returns address of the HTTP Server
// HTTPAddress() is only available once the server has been started.
func (s *Server) HTTPAddress() string {
	if s.httpListener == nil {
		return ""
	}
	protocol := "http"
	addr := s.httpListener.Addr().(*net.TCPAddr)
	return fmt.Sprintf("%s://%s:%d", protocol, s.cfg.hostname, addr.Port)
}

// GRPCAddress returns address of the gRPC Server
// GRPCAddress() is only available once the server has been started.
func (s *Server) GRPCAddress() string {
	if s.grpcListener == nil {
		return ""
	}
	addr := s.grpcListener.Addr().(*net.TCPAddr)
	return fmt.Sprintf("%s:%d", s.cfg.hostname, addr.Port)
}

func (s *Server) DebugAddress() string {
	if s.debugListener == nil {
		return ""
	}
	protocol := "http"
	addr := s.debugListener.Addr().(*net.TCPAddr)
	return fmt.Sprintf("%s://%s:%d", protocol, s.cfg.hostname, addr.Port)
}

func (s *Server) HTTPMux() *http.ServeMux {
	return s.httpMux
}

func (s *Server) GRPC() *grpc.Server {
	return s.grpc
}

func (s *Server) MetricsRegistry() *prometheus.Registry {
	return s.cfg.metricsRegistry
}

func (s *Server) close(ctx context.Context) error {
	if s.listening == nil {
		return fmt.Errorf("server is not running, invalid close operation")
	}

	if s.isClosing() {
		s.Logger().Info("Server is already closing.")
		return nil
	}

	s.Logger().Info("Received graceful shutdown request.")
	close(s.listening)

	if s.isGRPCEnabled() {
		s.grpc.GracefulStop()
		// s.grpc.GracefulStop() also closes the underlying net.Listener, we just release the reference.
		s.grpcListener = nil
		s.Logger().Info("GRPC server terminated.")
	}

	if s.isHTTPEnabled() {
		if err := s.http.Shutdown(ctx); err != nil {
			return fmt.Errorf("failed to close http server: %w", err)
		}
		// s.http.Shutdown() also closes the underlying net.Listener, we just release the reference.
		s.httpListener = nil
		s.Logger().Info("HTTP server terminated.")
	}

	// Always terminate debug server last, we want to keep it running for as long as possible
	if err := s.debug.Shutdown(ctx); err != nil {
		return fmt.Errorf("failed to close debug server: %w", err)
	}
	// s.http.Shutdown() also closes the underlying net.Listener, we just release the reference.
	s.debugListener = nil
	s.Logger().Info("Debug server terminated.")

	return nil
}

func (s *Server) isClosing() bool {
	select {
	case <-s.listening:
		// listening channel is closed, we're in graceful shutdown mode
		return true
	default:
		return false
	}
}

func (s *Server) initializeHTTP() error {
	s.httpMux = http.NewServeMux()
	s.http = &http.Server{
		Addr:    fmt.Sprintf(":%d", s.cfg.httpPort),
		Handler: s.httpMux,
	}

	return nil
}

func (s *Server) initializeDebug() error {
	logger := s.Logger().WithField("protocol", "debug")

	mux := http.NewServeMux()

	mux.HandleFunc("/ready", s.cfg.healthHandler.ReadyEndpoint)
	logger.Debug("Serving readiness handler on /ready")

	mux.HandleFunc("/live", s.cfg.healthHandler.LiveEndpoint)
	logger.Debug("Serving liveliness handler on /live")

	mux.Handle("/metrics", promhttp.InstrumentMetricHandler(
		s.cfg.metricsRegistry, promhttp.HandlerFor(s.cfg.metricsRegistry, promhttp.HandlerOpts{}),
	))
	s.Logger().WithField("protocol", "http").Debug("Serving metrics on /metrics")

	mux.Handle(pprof.Path, pprof.Handler())
	logger.Debug("Serving profiler on /debug/pprof")

	s.debug = &http.Server{
		Addr:    fmt.Sprintf(":%d", s.cfg.debugPort),
		Handler: mux,
	}

	return nil
}

func (s *Server) initializeGRPC() error {
	gitpod_grpc.SetupLogging()

	grpcMetrics := grpc_prometheus.NewServerMetrics()
	grpcMetrics.EnableHandlingTimeHistogram()
	if err := s.MetricsRegistry().Register(grpcMetrics); err != nil {
		return fmt.Errorf("failed to register grpc metrics: %w", err)
	}

	unary := []grpc.UnaryServerInterceptor{
		grpc_logrus.UnaryServerInterceptor(s.Logger()),
		grpcMetrics.UnaryServerInterceptor(),
	}
	stream := []grpc.StreamServerInterceptor{
		grpc_logrus.StreamServerInterceptor(s.Logger()),
		grpcMetrics.StreamServerInterceptor(),
	}

	s.grpc = grpc.NewServer(gitpod_grpc.ServerOptionsWithInterceptors(stream, unary)...)

	// Register health service by default
	grpc_health_v1.RegisterHealthServer(s.grpc, s.cfg.grpcHealthCheck)

	return nil
}

func (s *Server) isGRPCEnabled() bool {
	return s.cfg.grpcPort >= 0
}

func (s *Server) isHTTPEnabled() bool {
	return s.cfg.httpPort >= 0
}
