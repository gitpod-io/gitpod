// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package baseserver

import (
	gitpod_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/heptiolabs/healthcheck"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/health/grpc_health_v1"
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
	grpcHealthService := &grpc_health_v1.UnimplementedHealthServer{}
	rateLimits := map[string]gitpod_grpc.RateLimit{
		"/grpc.health.v1.Health/Check": {},
	}

	var opts = []Option{
		WithHostname(hostname),
		WithHTTPPort(httpPort),
		WithGRPCPort(grpcPort),
		WithLogger(logger),
		WithCloseTimeout(timeout),
		WithMetricsRegistry(registry),
		WithHealthHandler(health),
		WithGRPCHealthService(grpcHealthService),
		WithRateLimits(rateLimits),
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
		grpcHealthCheck: grpcHealthService,
		rateLimits:      rateLimits,
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
