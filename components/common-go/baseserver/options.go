// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package baseserver

import (
	"errors"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/heptiolabs/healthcheck"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"os"
	"time"
)

type config struct {
	logger *logrus.Entry

	// hostname is the hostname on which our servers will listen.
	hostname string
	// grpcPort is the port we listen on for gRPC traffic
	grpcPort int
	// httpPort is the port we listen on for HTTP traffic
	httpPort int

	tls *tlsConfig

	// closeTimeout is the amount we allow for the server to shut down cleanly
	closeTimeout time.Duration

	// metricsRegistry configures the metrics registry to use for exporting metrics. When not set, the default prometheus registry is used.
	metricsRegistry *prometheus.Registry

	healthHandler healthcheck.Handler
}

type tlsConfig struct {
	// file path to CA Certificate
	certFilePath string
	// File Path to Certificate Key
	keyFilePath string
}

func defaultConfig() *config {
	return &config{
		logger:        log.New(),
		hostname:      "localhost",
		httpPort:      9000,
		grpcPort:      9001,
		closeTimeout:  5 * time.Second,
		healthHandler: healthcheck.NewHandler(),
	}
}

type Option func(cfg *config) error

func WithHostname(hostname string) Option {
	return func(cfg *config) error {
		cfg.hostname = hostname
		return nil
	}
}

func WithHTTPPort(port int) Option {
	return func(cfg *config) error {
		if port < 0 {
			return fmt.Errorf("http must not be negative, got: %d", port)
		}

		cfg.httpPort = port
		return nil
	}
}

func WithGRPCPort(port int) Option {
	return func(cfg *config) error {
		if port < 0 {
			return fmt.Errorf("grpc port must not be negative, got: %d", port)
		}

		cfg.grpcPort = port
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

func WithTLS(certPath, keyPath string) Option {
	return func(cfg *config) error {
		if _, err := os.Stat(certPath); errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("certificate file %s does not exist: %w", certPath, err)
		}

		if _, err := os.Stat(keyPath); errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("key file %s does not exist: %w", certPath, err)
		}

		cfg.tls = &tlsConfig{
			certFilePath: certPath,
			keyFilePath:  keyPath,
		}

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
