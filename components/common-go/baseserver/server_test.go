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
	srv, err := baseserver.New("server_test", baseserver.WithHTTPPort(8765), baseserver.WithGRPCPort(8766), baseserver.WithDebugPort(8767))
	require.NoError(t, err)
	baseserver.StartServerForTests(t, srv)

	require.Equal(t, "http://localhost:8765", srv.HTTPAddress())
	require.Equal(t, "localhost:8766", srv.GRPCAddress())
	require.Equal(t, "http://localhost:8767", srv.DebugAddress())
	require.NoError(t, srv.Close())
}

func TestServer_ServerCombinations_StartsAndStops(t *testing.T) {
	scenarios := []struct {
		startHTTP bool
		startGRPC bool
	}{
		{startHTTP: false, startGRPC: false},
		{startHTTP: true, startGRPC: false},
		{startHTTP: true, startGRPC: true},
		{startHTTP: false, startGRPC: true},
	}

	for _, scenario := range scenarios {
		t.Run(fmt.Sprintf("with grpc: %v, http: %v", scenario.startGRPC, scenario.startHTTP), func(t *testing.T) {
			opts := []baseserver.Option{baseserver.WithDebugPort(9000)}

			if scenario.startHTTP {
				opts = append(opts, baseserver.WithHTTPPort(7000))
			} else {
				opts = append(opts, baseserver.WithHTTPPort(-1))
			}

			if scenario.startGRPC {
				opts = append(opts, baseserver.WithGRPCPort(8000))
			} else {
				opts = append(opts, baseserver.WithGRPCPort(-1))
			}

			srv := baseserver.NewForTests(t, opts...)
			baseserver.StartServerForTests(t, srv)

			require.Equal(t, "http://localhost:9000", srv.DebugAddress())
			if scenario.startHTTP {
				require.Equal(t, "http://localhost:7000", srv.HTTPAddress(), "must serve http on port 7000 because startHTTP was set")
			} else {
				require.Empty(t, srv.HTTPAddress(), "must not serve http")
			}

			if scenario.startGRPC {
				require.Equal(t, "localhost:8000", srv.GRPCAddress(), "must serve grpc on port 8000 because startGRPC was set")
			} else {
				require.Empty(t, srv.GRPCAddress(), "must not serve grpc")
			}
		})
	}
}

func TestServer_OnlyDebug(t *testing.T) {
	srv := baseserver.NewForTests(t, baseserver.WithGRPCPort(-1), baseserver.WithHTTPPort(-1), baseserver.WithDebugPort(7777))
	baseserver.StartServerForTests(t, srv)

	require.Empty(t, srv.HTTPAddress(), "server not started, address must be empty")
	require.Empty(t, srv.GRPCAddress(), "server not started, address must be empty")
	require.Equal(t, "http://localhost:7777", srv.DebugAddress())
}

func TestServer_Debug_HealthEndpoints(t *testing.T) {
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

			resp, err := http.Get(srv.DebugAddress() + scenario.endpoint)
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, resp.StatusCode)
		})
	}
}

func TestServer_Debug_MetricsEndpointWithDefaultConfig(t *testing.T) {
	srv := baseserver.NewForTests(t)

	baseserver.StartServerForTests(t, srv)

	readyUR := fmt.Sprintf("%s/metrics", srv.DebugAddress())
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

	readyUR := fmt.Sprintf("%s/metrics", srv.DebugAddress())
	resp, err := http.Get(readyUR)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestServer_ServesPprof(t *testing.T) {
	srv := baseserver.NewForTests(t)
	baseserver.StartServerForTests(t, srv)

	resp, err := http.Get(srv.DebugAddress() + pprof.Path)
	require.NoError(t, err)
	require.Equalf(t, http.StatusOK, resp.StatusCode, "must serve pprof on %s", pprof.Path)
}

func TestServer_Metrics_gRPC(t *testing.T) {
	ctx := context.Background()
	srv := baseserver.NewForTests(t)

	// At this point, there must be metrics registry available for use
	require.NotNil(t, srv.MetricsRegistry())
	// Let's start our server up
	baseserver.StartServerForTests(t, srv)

	// We need a client to be able to invoke the RPC, let's construct one
	conn, err := grpc.DialContext(ctx, srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	client := grpc_health_v1.NewHealthClient(conn)

	// By default the server runs a Health service, we can use it for our purposes
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
