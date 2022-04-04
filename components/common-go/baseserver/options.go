package baseserver

import (
	"fmt"
	"github.com/sirupsen/logrus"
	"strings"
)

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
			return fmt.Errorf("http port must be greater than 0, got: %d", port)
		}

		cfg.httpPort = port
		return nil
	}
}

func WithGRPCPort(port int) Option {
	return func(cfg *config) error {
		if port < 0 {
			return fmt.Errorf("grpc port must be greater than 0, got: %d", port)
		}

		cfg.grpcPort = port
		return nil
	}
}

func WithTLS(certs Certs) Option {
	return func(cfg *config) error {
		caCertPath := strings.TrimSpace(certs.CACertPath)
		serverCertPath := strings.TrimSpace(certs.ServerCertPath)
		serverKeyPath := strings.TrimSpace(certs.ServerKeyPath)

		if caCertPath == "" {
			return fmt.Errorf("empty certificate authority path specified")
		}
		if serverCertPath == "" {
			return fmt.Errorf("empty server certificate path specified")
		}
		if serverKeyPath == "" {
			return fmt.Errorf("empty server key path specified")
		}

		cfg.certs = &certs
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

func evaluateOptions(cfg *config, opts ...Option) (*config, error) {
	for _, opt := range opts {
		if err := opt(cfg); err != nil {
			return nil, fmt.Errorf("failed to evaluate config: %w", err)
		}
	}

	return cfg, nil
}
