// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package baseserver

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	grpc_logrus "github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus"
	grpc_prometheus "github.com/grpc-ecosystem/go-grpc-prometheus"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
	http_metrics "github.com/slok/go-http-metrics/metrics/prometheus"
	"github.com/slok/go-http-metrics/middleware"
	"github.com/slok/go-http-metrics/middleware/std"
	"golang.org/x/sync/errgroup"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"
)

func New(name string, opts ...Option) (*Server, error) {
	options, err := evaluateOptions(defaultOptions(), opts...)
	if err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	server := &Server{
		Name:    name,
		options: options,
	}
	server.builtinServices = newBuiltinServices(server)
	server.tracingCloser = tracing.Init(name)

	server.httpMux = http.NewServeMux()
	server.http = &http.Server{Handler: std.Handler("", middleware.New(middleware.Config{
		Recorder: http_metrics.NewRecorder(http_metrics.Config{
			Prefix:   "gitpod",
			Registry: server.MetricsRegistry(),
		}),
	}), server.httpMux)}

	err = server.initializeMetrics()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize metrics: %w", err)
	}

	err = server.initializeGRPC()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize gRPC server: %w", err)
	}

	return server, nil
}

// Server is a packaged server with batteries included. It is designed to be standard across components where it makes sense.
// Server implements graceful shutdown making it suitable for usage in integration tests. See server_test.go.
//
// Server is composed of the following:
//   - Debug server which serves observability and debug endpoints
//   - /metrics for Prometheus metrics
//   - /pprof for Golang profiler
//   - /ready for kubernetes readiness check
//   - /live for kubernetes liveness check
//   - (optional) gRPC server with standard interceptors and configuration
//   - Started when baseserver is configured WithGRPCPort (port is non-negative)
//   - Use Server.GRPC() to get access to the underlying grpc.Server and register services
//   - (optional) HTTP server
//   - Currently does not come with any standard HTTP middlewares
//   - Started when baseserver is configured WithHTTPPort (port is non-negative)
//   - Use Server.HTTPMux() to get access to the root handler and register your endpoints
type Server struct {
	// Name is the name of this server, used for logging context
	Name string

	options *options

	builtinServices *builtinServices

	// http is an http Server, only used when port is specified in cfg
	http         *http.Server
	httpMux      *http.ServeMux
	httpListener net.Listener

	// grpc is a grpc Server, only used when port is specified in cfg
	grpc         *grpc.Server
	grpcListener net.Listener

	tracingCloser io.Closer

	// listening indicates the server is serving. When closed, the server is in the process of graceful termination.
	listening chan struct{}
	closeOnce sync.Once
}

func serveHTTP(cfg *ServerConfiguration, srv *http.Server, l net.Listener) (err error) {
	if cfg.TLS == nil {
		err = srv.Serve(l)
	} else {
		err = srv.ServeTLS(l, cfg.TLS.CertPath, cfg.TLS.KeyPath)
	}
	return
}

func (s *Server) ListenAndServe() error {
	var err error

	s.listening = make(chan struct{})
	defer func() {
		err := s.Close()
		if err != nil {
			s.Logger().WithError(err).Errorf("cannot close gracefully")
		}
	}()

	go func() {
		err := s.builtinServices.ListenAndServe()
		if err != nil {
			s.Logger().WithError(err).Errorf("builtin services encountered an error - closing remaining servers.")
			s.Close()
		}
	}()

	if srv := s.options.config.Services.HTTP; srv != nil {
		s.httpListener, err = net.Listen("tcp", srv.Address)
		if err != nil {
			return fmt.Errorf("failed to start HTTP server: %w", err)
		}
		s.http.Addr = srv.Address

		go func() {
			err := serveHTTP(srv, s.http, s.httpListener)
			if err != nil {
				s.Logger().WithError(err).Errorf("HTTP server encountered an error - closing remaining servers.")
				s.Close()
			}
		}()
	}

	if srv := s.options.config.Services.GRPC; srv != nil {
		s.grpcListener, err = net.Listen("tcp", srv.Address)
		if err != nil {
			return fmt.Errorf("failed to start gRPC server: %w", err)
		}

		go func() {
			err := s.grpc.Serve(s.grpcListener)
			if err != nil {
				s.Logger().WithError(err).Errorf("gRPC server encountered an error - closing remaining servers.")
				s.Close()
			}
		}()
	}

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)

	// Await operating system signals, or server errors.
	sig := <-signals
	s.Logger().Infof("Received system signal %s, closing server.", sig.String())
	return nil
}

func (s *Server) Close() error {
	ctx, cancel := context.WithTimeout(context.Background(), s.options.closeTimeout)
	defer cancel()

	var err error
	s.closeOnce.Do(func() {
		err = s.close(ctx)
	})
	return err
}

func (s *Server) Logger() *logrus.Entry {
	return s.options.logger
}

func (s *Server) HTTPMux() *http.ServeMux {
	return s.httpMux
}

func (s *Server) GRPC() *grpc.Server {
	return s.grpc
}

func (s *Server) MetricsRegistry() *prometheus.Registry {
	return s.options.metricsRegistry
}

func (s *Server) Tracer() opentracing.Tracer {
	return opentracing.GlobalTracer()
}

func (s *Server) close(ctx context.Context) error {
	if s.listening == nil {
		return fmt.Errorf("server is not running, invalid close operation")
	}

	if s.isClosing() {
		s.Logger().Debug("Server is already closing.")
		return nil
	}

	s.Logger().Info("Received graceful shutdown request.")
	close(s.listening)

	if s.grpc != nil {
		s.grpc.GracefulStop()
		// s.grpc.GracefulStop() also closes the underlying net.Listener, we just release the reference.
		s.grpcListener = nil
		s.Logger().Info("GRPC server terminated.")
	}

	if s.http != nil {
		err := s.http.Shutdown(ctx)
		if err != nil {
			return fmt.Errorf("failed to close http server: %w", err)
		}
		// s.http.Shutdown() also closes the underlying net.Listener, we just release the reference.
		s.httpListener = nil
		s.Logger().Info("HTTP server terminated.")
	}

	// Always terminate builtin server last, we want to keep it running for as long as possible
	err := s.builtinServices.Close()
	if err != nil {
		return fmt.Errorf("failed to close debug server: %w", err)
	}
	s.Logger().Info("Debug server terminated.")

	err = s.tracingCloser.Close()
	if err != nil {
		return fmt.Errorf("failed to close tracing: %w", err)
	}

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

func (s *Server) healthEndpoint() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/ready", s.options.healthHandler.ReadyEndpoint)
	mux.HandleFunc("/live", s.options.healthHandler.LiveEndpoint)
	return mux
}

func (s *Server) metricsEndpoint() http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.InstrumentMetricHandler(
		s.options.metricsRegistry, promhttp.HandlerFor(s.options.metricsRegistry, promhttp.HandlerOpts{}),
	))
	return mux
}

func (s *Server) initializeGRPC() error {
	common_grpc.SetupLogging()

	grpcMetrics := grpc_prometheus.NewServerMetrics()
	grpcMetrics.EnableHandlingTimeHistogram(
		grpc_prometheus.WithHistogramBuckets([]float64{.005, .025, .05, .1, .5, 1, 2.5, 5, 30, 60, 120, 240, 600}),
	)
	if err := s.MetricsRegistry().Register(grpcMetrics); err != nil {
		return fmt.Errorf("failed to register grpc metrics: %w", err)
	}

	unary := []grpc.UnaryServerInterceptor{
		grpc_logrus.UnaryServerInterceptor(s.Logger(),
			grpc_logrus.WithDecider(func(fullMethodName string, err error) bool {
				// Skip logs for anything that does not contain an error.
				if err == nil {
					return false
				}
				// Skip gRPC healthcheck logs, they are frequent and pollute our logging infra
				return fullMethodName != "/grpc.health.v1.Health/Check"
			}),
		),
		grpcMetrics.UnaryServerInterceptor(),
	}
	stream := []grpc.StreamServerInterceptor{
		grpc_logrus.StreamServerInterceptor(s.Logger()),
		grpcMetrics.StreamServerInterceptor(),
	}

	opts := common_grpc.ServerOptionsWithInterceptors(stream, unary)
	if cfg := s.options.config.Services.GRPC; cfg != nil && cfg.TLS != nil {
		tlsConfig, err := common_grpc.ClientAuthTLSConfig(
			cfg.TLS.CAPath, cfg.TLS.CertPath, cfg.TLS.KeyPath,
			common_grpc.WithSetClientCAs(true),
			common_grpc.WithServerName(s.Name),
		)
		if err != nil {
			return fmt.Errorf("failed to load certificates: %w", err)
		}

		opts = append(opts, grpc.Creds(credentials.NewTLS(tlsConfig)))
	}

	opts = append(opts, grpc.MaxRecvMsgSize(100*1024*1024))
	s.grpc = grpc.NewServer(opts...)

	reflection.Register(s.grpc)

	// Register health service by default
	grpc_health_v1.RegisterHealthServer(s.grpc, s.options.grpcHealthCheck)

	return nil
}

func (s *Server) initializeMetrics() error {
	err := s.MetricsRegistry().Register(collectors.NewGoCollector())
	if err != nil {
		return fmt.Errorf("faile to register go collectors: %w", err)
	}

	err = s.MetricsRegistry().Register(collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}))
	if err != nil {
		return fmt.Errorf("failed to register process collectors: %w", err)
	}

	err = registerMetrics(s.MetricsRegistry())
	if err != nil {
		return fmt.Errorf("failed to register baseserver metrics: %w", err)
	}

	if err := s.MetricsRegistry().Register(log.DefaultMetrics); err != nil {
		return fmt.Errorf("failed to register log metrics: %w", err)
	}

	reportServerVersion(s.options.version)

	return nil
}

func (s *Server) DebugAddress() string {
	if s.builtinServices == nil {
		return ""
	}
	return "http://" + s.builtinServices.Debug.Addr
}
func (s *Server) HealthAddr() string {
	if s.builtinServices == nil {
		return ""
	}
	return "http://" + s.builtinServices.Health.Addr
}
func (s *Server) HTTPAddress() string {
	return httpAddress(s.options.config.Services.HTTP, s.httpListener)
}
func (s *Server) GRPCAddress() string {
	// If the server hasn't started, it won't have a listener yet
	if s.grpcListener == nil {
		return ""
	}

	return s.grpcListener.Addr().String()
}

const (
	BuiltinDebugPort   = 6060
	BuiltinMetricsPort = 9500
	BuiltinHealthPort  = 9501

	BuiltinMetricsPortName = "metrics"
)

type builtinServices struct {
	underTest bool

	Debug   *http.Server
	Health  *http.Server
	Metrics *http.Server
}

func newBuiltinServices(server *Server) *builtinServices {
	healthAddr := fmt.Sprintf(":%d", BuiltinHealthPort)
	if server.options.underTest {
		healthAddr = ":0"
	}

	return &builtinServices{
		underTest: server.options.underTest,
		Debug: &http.Server{
			Addr:    fmt.Sprintf(":%d", BuiltinDebugPort),
			Handler: pprof.Handler(),
		},
		Health: &http.Server{
			Addr:    healthAddr,
			Handler: server.healthEndpoint(),
		},
		Metrics: &http.Server{
			Addr:    fmt.Sprintf("127.0.0.1:%d", BuiltinMetricsPort),
			Handler: server.metricsEndpoint(),
		},
	}
}

func (s *builtinServices) ListenAndServe() error {
	if s == nil {
		return nil
	}

	var eg errgroup.Group
	if !s.underTest {
		eg.Go(func() error { return s.Debug.ListenAndServe() })
		eg.Go(func() error { return s.Metrics.ListenAndServe() })
	}
	eg.Go(func() error {
		// health is the only service which has a variable address,
		// because we need the health service to figure out if the
		// server started at all
		l, err := net.Listen("tcp", s.Health.Addr)
		if err != nil {
			return err
		}
		s.Health.Addr = l.Addr().String()
		err = s.Health.Serve(l)
		if err == http.ErrServerClosed {
			return nil
		}
		return err
	})
	return eg.Wait()
}

func (s *builtinServices) Close() error {
	var eg errgroup.Group
	eg.Go(func() error { return s.Debug.Close() })
	eg.Go(func() error { return s.Metrics.Close() })
	eg.Go(func() error { return s.Health.Close() })
	return eg.Wait()
}

func httpAddress(cfg *ServerConfiguration, l net.Listener) string {
	if l == nil {
		return ""
	}
	protocol := "http"
	if cfg != nil && cfg.TLS != nil {
		protocol = "https"
	}
	return fmt.Sprintf("%s://%s", protocol, l.Addr().String())
}
