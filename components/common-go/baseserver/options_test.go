// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package baseserver

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/heptiolabs/healthcheck"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"os"
	"testing"
	"time"
)

func TestOptions(t *testing.T) {
	logger := log.New()
	httpPort := 8080
	grpcPort := 8081
	timeout := 10 * time.Second
	hostname := "another_hostname"
	registry := prometheus.NewRegistry()
	health := healthcheck.NewHandler()

	var opts = []Option{
		WithHostname(hostname),
		WithHTTPPort(httpPort),
		WithGRPCPort(grpcPort),
		WithLogger(logger),
		WithCloseTimeout(timeout),
		WithMetricsRegistry(registry),
		WithHealthHandler(health),
	}
	cfg, err := evaluateOptions(defaultConfig(), opts...)
	require.NoError(t, err)

	require.Equal(t, &config{
		logger:          logger,
		hostname:        hostname,
		grpcPort:        grpcPort,
		httpPort:        httpPort,
		closeTimeout:    timeout,
		metricsRegistry: registry,
		healthHandler:   health,
	}, cfg)
}

func TestWithTTPPort(t *testing.T) {
	t.Run("negative", func(t *testing.T) {
		_, err := evaluateOptions(defaultConfig(), WithHTTPPort(-1))
		require.Error(t, err)
	})

	t.Run("zero", func(t *testing.T) {
		_, err := evaluateOptions(defaultConfig(), WithHTTPPort(0))
		require.NoError(t, err)
	})
}

func TestWithGRPCPort(t *testing.T) {
	t.Run("negative", func(t *testing.T) {
		_, err := evaluateOptions(defaultConfig(), WithGRPCPort(-1))
		require.Error(t, err)
	})

	t.Run("zero", func(t *testing.T) {
		_, err := evaluateOptions(defaultConfig(), WithGRPCPort(0))
		require.NoError(t, err)
	})
}

func TestLogger_ErrorsWithNilLogger(t *testing.T) {
	_, err := evaluateOptions(defaultConfig(), WithLogger(nil))
	require.Error(t, err)
}

func TestWithTLS(t *testing.T) {

	t.Run("with valid file paths", func(t *testing.T) {
		cert, err := os.CreateTemp("", "test_cert")
		require.NoError(t, err)
		key, err := os.CreateTemp("", "test_key")
		require.NoError(t, err)

		cfg, err := evaluateOptions(defaultConfig(), WithTLS(cert.Name(), key.Name()))
		require.NoError(t, err)
		require.Equal(t, &tlsConfig{
			certFilePath: cert.Name(),
			keyFilePath:  key.Name(),
		}, cfg.tls)
	})

}
