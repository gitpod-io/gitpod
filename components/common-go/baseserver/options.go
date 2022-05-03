// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package baseserver

import (
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/heptiolabs/healthcheck"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/health/grpc_health_v1"
	"time"
)

type config struct {
	logger *logrus.Entry

	// hostname is the hostname on which our servers will listen.
	hostname string
	// debugPort is the port we listen on for metrics, pprof, readiness and livenss checks
	debugPort int
	// grpcPort is the port we listen on for gRPC traffic
	grpcPort int
	// httpPort is the port we listen on for HTTP traffic
	httpPort int

	// closeTimeout is the amount we allow for the server to shut down cleanly
	closeTimeout time.Duration

	// metricsRegistry configures the metrics registry to use for exporting metrics. When not set, the default prometheus registry is used.
	metricsRegistry *prometheus.Registry

	healthHandler healthcheck.Handler

	grpcHealthCheck grpc_health_v1.HealthServer
}

func defaultConfig() *config {
	return &config{
		logger:          log.New(),
		hostname:        "localhost",
		httpPort:        -1, // disabled by default
		grpcPort:        -1, // disabled by default
		debugPort:       9500,
		closeTimeout:    5 * time.Second,
		healthHandler:   healthcheck.NewHandler(),
		metricsRegistry: prometheus.NewRegistry(),
		grpcHealthCheck: &GrpcHealthService{},
	}
}

type Option func(cfg *config) error

func WithHostname(hostname string) Option {
	return func(cfg *config) error {
		cfg.hostname = hostname
		return nil
	}
}

// WithHTTPPort sets the port to use for an HTTP server. Setting WithHTTPPort also enables an HTTP server on the baseserver.
func WithHTTPPort(port int) Option {
	return func(cfg *config) error {
		cfg.httpPort = port
		return nil
	}
}

// WithGRPCPort sets the port to use for an HTTP server. Setting WithGRPCPort also enables a gRPC server on the baseserver.
func WithGRPCPort(port int) Option {
	return func(cfg *config) error {
		cfg.grpcPort = port
		return nil
	}
}

func WithDebugPort(port int) Option {
	return func(cfg *config) error {
		if port < 0 {
			return fmt.Errorf("grpc port must not be negative, got: %d", port)
		}

		cfg.debugPort = port
		return nil
	}
}

func WithLogger(logger *logrus.Entry) Option {
	return func(cfg *config) error {
		if logger == nil {
			return fmt.Errorf("nil logger specified")
		}

		cfg.logger = logger
		return nil
	}
}

func WithCloseTimeout(d time.Duration) Option {
	return func(cfg *config) error {
		cfg.closeTimeout = d
		return nil
	}
}

func WithMetricsRegistry(r *prometheus.Registry) Option {
	return func(cfg *config) error {
		if r == nil {
			return fmt.Errorf("nil prometheus registry received")
		}

		cfg.metricsRegistry = r
		return nil
	}
}

func WithHealthHandler(handler healthcheck.Handler) Option {
	return func(cfg *config) error {
		if handler == nil {
			return fmt.Errorf("nil healthcheck handler provided")
		}

		cfg.healthHandler = handler
		return nil
	}
}

func WithGRPCHealthService(svc grpc_health_v1.HealthServer) Option {
	return func(cfg *config) error {
		if svc == nil {
			return fmt.Errorf("nil healthcheck handler provided")
		}

		cfg.grpcHealthCheck = svc
		return nil
	}
}

func evaluateOptions(cfg *config, opts ...Option) (*config, error) {
	for _, opt := range opts {
		if err := opt(cfg); err != nil {
			return nil, fmt.Errorf("failed to evaluate config: %w", err)
		}
	}

	return cfg, nil
}

type GrpcHealthService struct {
	grpc_health_v1.UnimplementedHealthServer
}

func (g *GrpcHealthService) Check(ctx context.Context, request *grpc_health_v1.HealthCheckRequest) (*grpc_health_v1.HealthCheckResponse, error) {
	return &grpc_health_v1.HealthCheckResponse{Status: grpc_health_v1.HealthCheckResponse_SERVING}, nil
}
