// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package baseserver

import (
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/heptiolabs/healthcheck"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/health/grpc_health_v1"
)

func TestOptions(t *testing.T) {
	logger := log.New()
	timeout := 10 * time.Second
	registry := prometheus.NewRegistry()
	health := healthcheck.NewHandler()
	grpcHealthService := &grpc_health_v1.UnimplementedHealthServer{}
	httpCfg := ServerConfiguration{Address: "localhost:8080"}
	grpcCfg := ServerConfiguration{Address: "localhost:8081"}

	var opts = []Option{
		WithHTTP(&httpCfg),
		WithGRPC(&grpcCfg),
		WithLogger(logger),
		WithCloseTimeout(timeout),
		WithMetricsRegistry(registry),
		WithHealthHandler(health),
		WithGRPCHealthService(grpcHealthService),
		WithVersion("foo-bar"),
	}
	actual, err := evaluateOptions(defaultOptions(), opts...)
	require.NoError(t, err)

	expected := &options{
		logger: logger,
		config: &Configuration{
			Services: ServicesConfiguration{
				GRPC: &grpcCfg,
				HTTP: &httpCfg,
			},
		},
		closeTimeout:    timeout,
		metricsRegistry: registry,
		healthHandler:   health,
		grpcHealthCheck: grpcHealthService,
		version:         "foo-bar",
	}

	require.Equal(t, expected, actual)
}

func TestLogger_ErrorsWithNilLogger(t *testing.T) {
	_, err := evaluateOptions(defaultOptions(), WithLogger(nil))
	require.Error(t, err)
}
