// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package baseserver_test

import (
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/pprof"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health/grpc_health_v1"
	"net/http"
	"testing"
)

func TestServer_StartStop(t *testing.T) {
	// We don't use the helper NewForTests, because we want to control stopping ourselves.
	srv, err := baseserver.New("server_test", baseserver.WithHTTPPort(8765), baseserver.WithGRPCPort(8766))
	require.NoError(t, err)
	baseserver.StartServerForTests(t, srv)

	require.Equal(t, "http://localhost:8765", srv.HTTPAddress())
	require.Equal(t, "localhost:8766", srv.GRPCAddress())
	require.NoError(t, srv.Close())
}

func TestServer_ServesHealthEndpoints(t *testing.T) {
	for _, scenario := range []struct {
		name     string
		endpoint string
	}{
		{name: "ready endpoint", endpoint: "/ready"},
		{name: "live endpoint", endpoint: "/live"},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			srv := baseserver.NewForTests(t)
			baseserver.StartServerForTests(t, srv)

			resp, err := http.Get(srv.HTTPAddress() + scenario.endpoint)
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, resp.StatusCode)
		})
	}
}

func TestServer_ServesMetricsEndpointWithDefaultConfig(t *testing.T) {
	srv := baseserver.NewForTests(t)

	baseserver.StartServerForTests(t, srv)

	readyUR := fmt.Sprintf("%s/metrics", srv.HTTPAddress())
	resp, err := http.Get(readyUR)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestServer_ServesMetricsEndpointWithCustomMetricsConfig(t *testing.T) {
	registry := prometheus.NewRegistry()
	srv := baseserver.NewForTests(t,
		baseserver.WithMetricsRegistry(registry),
	)

	baseserver.StartServerForTests(t, srv)

	readyUR := fmt.Sprintf("%s/metrics", srv.HTTPAddress())
	resp, err := http.Get(readyUR)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestServer_ServesPprof(t *testing.T) {
	srv := baseserver.NewForTests(t)
	baseserver.StartServerForTests(t, srv)

	resp, err := http.Get(srv.HTTPAddress() + pprof.Path)
	require.NoError(t, err)
	require.Equalf(t, http.StatusOK, resp.StatusCode, "must serve pprof on %s", pprof.Path)
}

func TestServer_Metrics_gRPC(t *testing.T) {
	ctx := context.Background()
	srv := baseserver.NewForTests(t)

	// At this point, there must be metrics registry available for use
	require.NotNil(t, srv.MetricsRegistry())

	// To actually get gRPC metrics, we need to invoke an RPC, let's use a built-in health service as a mock
	grpc_health_v1.RegisterHealthServer(srv.GRPC(), &HealthService{})

	// Let's start our server up
	baseserver.StartServerForTests(t, srv)

	// We need a client to be able to invoke the RPC, let's construct one
	conn, err := grpc.DialContext(ctx, srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	client := grpc_health_v1.NewHealthClient(conn)

	// Invoke the RPC
	_, err = client.Check(ctx, &grpc_health_v1.HealthCheckRequest{})
	require.NoError(t, err)

	// Finally, we can assert that some metrics were produced.
	registry := srv.MetricsRegistry()
	// We expect at least the following. It's not the full set, but a good baseline to sanity check.
	expected := []string{"grpc_server_handled_total", "grpc_server_handling_seconds", "grpc_server_started_total"}

	count, err := testutil.GatherAndCount(registry, expected...)
	require.NoError(t, err)
	require.Equal(t, len(expected)*1, count, "expected 1 count for each metric")
}

type HealthService struct {
	grpc_health_v1.UnimplementedHealthServer
}

func (h *HealthService) Check(_ context.Context, _ *grpc_health_v1.HealthCheckRequest) (*grpc_health_v1.HealthCheckResponse, error) {
	return &grpc_health_v1.HealthCheckResponse{Status: grpc_health_v1.HealthCheckResponse_SERVING}, nil
}
