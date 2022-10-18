// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package baseserver

import (
	"context"
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/heptiolabs/healthcheck"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc/health/grpc_health_v1"
)

type options struct {
	logger *logrus.Entry

	// version is the version of this application
	version string

	config *Configuration

	// closeTimeout is the amount we allow for the server to shut down cleanly
	closeTimeout time.Duration

	underTest bool

	// metricsRegistry configures the metrics registry to use for exporting metrics. When not set, the default prometheus registry is used.
	metricsRegistry *prometheus.Registry

	healthHandler healthcheck.Handler

	grpcHealthCheck grpc_health_v1.HealthServer
}

func defaultOptions() *options {
	return &options{
		logger:  log.New(),
		version: "unknown",
		config: &Configuration{
			Services: ServicesConfiguration{
				GRPC: nil, // disabled by default
				HTTP: nil, // disabled by default
			},
		},

		closeTimeout:    5 * time.Second,
		healthHandler:   healthcheck.NewHandler(),
		metricsRegistry: prometheus.NewRegistry(),
		grpcHealthCheck: &GrpcHealthService{},
	}
}

type Option func(opts *options) error

// WithConfig uses a config struct to initialise the services
func WithConfig(config *Configuration) Option {
	return func(opts *options) error {
		opts.config = config
		return nil
	}
}

func WithVersion(version string) Option {
	return func(opts *options) error {
		opts.version = version
		return nil
	}
}

func WithUnderTest() Option {
	return func(opts *options) error {
		opts.underTest = true
		return nil
	}
}

// WithHTTP configures and enables the HTTP server.
func WithHTTP(cfg *ServerConfiguration) Option {
	return func(opts *options) error {
		opts.config.Services.HTTP = cfg
		return nil
	}
}

// WithGRPC configures and enables the GRPC server.
func WithGRPC(cfg *ServerConfiguration) Option {
	return func(opts *options) error {
		opts.config.Services.GRPC = cfg
		return nil
	}
}

func WithLogger(logger *logrus.Entry) Option {
	return func(opts *options) error {
		if logger == nil {
			return fmt.Errorf("nil logger specified")
		}

		opts.logger = logger
		return nil
	}
}

func WithCloseTimeout(d time.Duration) Option {
	return func(opts *options) error {
		opts.closeTimeout = d
		return nil
	}
}

func WithMetricsRegistry(r *prometheus.Registry) Option {
	return func(opts *options) error {
		if r == nil {
			return fmt.Errorf("nil prometheus registry received")
		}

		opts.metricsRegistry = r
		return nil
	}
}

func WithHealthHandler(handler healthcheck.Handler) Option {
	return func(opts *options) error {
		if handler == nil {
			return fmt.Errorf("nil healthcheck handler provided")
		}

		opts.healthHandler = handler
		return nil
	}
}

func WithGRPCHealthService(svc grpc_health_v1.HealthServer) Option {
	return func(opts *options) error {
		if svc == nil {
			return fmt.Errorf("nil healthcheck handler provided")
		}

		opts.grpcHealthCheck = svc
		return nil
	}
}

func evaluateOptions(cfg *options, opts ...Option) (*options, error) {
	for _, opt := range opts {
		if err := opt(cfg); err != nil {
			return nil, fmt.Errorf("failed to evaluate options: %w", err)
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
