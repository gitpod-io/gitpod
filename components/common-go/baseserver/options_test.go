// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package baseserver

import (
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
	debugPort := 8082
	timeout := 10 * time.Second
	hostname := "another_hostname"
	registry := prometheus.NewRegistry()
	health := healthcheck.NewHandler()
	grpcHealthService := &grpc_health_v1.UnimplementedHealthServer{}

	var opts = []Option{
		WithHostname(hostname),
		WithDebugPort(debugPort),
		WithHTTPPort(httpPort),
		WithGRPCPort(grpcPort),
		WithLogger(logger),
		WithCloseTimeout(timeout),
		WithMetricsRegistry(registry),
		WithHealthHandler(health),
		WithGRPCHealthService(grpcHealthService),
	}
	cfg, err := evaluateOptions(defaultConfig(), opts...)
	require.NoError(t, err)

	require.Equal(t, &config{
		logger:          logger,
		hostname:        hostname,
		grpcPort:        grpcPort,
		httpPort:        httpPort,
		debugPort:       debugPort,
		closeTimeout:    timeout,
		metricsRegistry: registry,
		healthHandler:   health,
		grpcHealthCheck: grpcHealthService,
	}, cfg)
}

func TestWithHTTPPort(t *testing.T) {
	for _, scenario := range []struct {
		Port     int
		Expected int
	}{
		{Port: -1, Expected: -1},
		{Port: 0, Expected: 0},
		{Port: 9000, Expected: 9000},
	} {
		cfg, err := evaluateOptions(defaultConfig(), WithHTTPPort(scenario.Port))
		require.NoError(t, err)
		require.Equal(t, scenario.Expected, cfg.httpPort)
	}
}

func TestWithGRPCPort(t *testing.T) {
	for _, scenario := range []struct {
		Port     int
		Expected int
	}{
		{Port: -1, Expected: -1},
		{Port: 0, Expected: 0},
		{Port: 9000, Expected: 9000},
	} {
		cfg, err := evaluateOptions(defaultConfig(), WithGRPCPort(scenario.Port))
		require.NoError(t, err)
		require.Equal(t, scenario.Expected, cfg.grpcPort)
	}
}

func TestWithDebugPort(t *testing.T) {
	for _, scenario := range []struct {
		Port int

		Errors   bool
		Expected int
	}{
		{Port: -1, Errors: true},
		{Port: 0, Expected: 0},
		{Port: 9000, Expected: 9000},
	} {
		cfg, err := evaluateOptions(defaultConfig(), WithDebugPort(scenario.Port))
		if scenario.Errors {
			require.Error(t, err)
			continue
		}

		require.Equal(t, scenario.Expected, cfg.debugPort)
	}
}

func TestLogger_ErrorsWithNilLogger(t *testing.T) {
	_, err := evaluateOptions(defaultConfig(), WithLogger(nil))
	require.Error(t, err)
}
