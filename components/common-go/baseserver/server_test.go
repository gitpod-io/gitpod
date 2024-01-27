// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package baseserver_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health/grpc_health_v1"
)

func TestServer_StartStop(t *testing.T) {
	// We don't use the helper NewForTests, because we want to control stopping ourselves.
	srv, err := baseserver.New("server_test",
		baseserver.WithUnderTest(),
		baseserver.WithHTTP(&baseserver.ServerConfiguration{Address: "localhost:8765"}),
		baseserver.WithGRPC(&baseserver.ServerConfiguration{Address: "localhost:8766"}),
	)
	require.NoError(t, err)
	baseserver.StartServerForTests(t, srv)

	require.Equal(t, "http://127.0.0.1:8765", srv.HTTPAddress())
	require.Equal(t, "127.0.0.1:8766", srv.GRPCAddress())
	require.NoError(t, srv.Close())
}

func TestServer_ServerCombinations_StartsAndStops(t *testing.T) {
	tests := []struct {
		StartHTTP bool
		StartGRPC bool
	}{
		{StartHTTP: false, StartGRPC: false},
		{StartHTTP: true, StartGRPC: false},
		{StartHTTP: true, StartGRPC: true},
		{StartHTTP: false, StartGRPC: true},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("with http: %v, grpc: %v", test.StartGRPC, test.StartHTTP), func(t *testing.T) {
			var opts []baseserver.Option
			opts = append(opts, baseserver.WithUnderTest())
			if test.StartHTTP {
				opts = append(opts, baseserver.WithHTTP(baseserver.MustUseRandomLocalAddress(t)))
			}

			if test.StartGRPC {
				opts = append(opts, baseserver.WithGRPC(baseserver.MustUseRandomLocalAddress(t)))
			}

			srv, err := baseserver.New("test_server", opts...)
			if err != nil {
				t.Fatal(err)
			}
			baseserver.StartServerForTests(t, srv)

			require.NotEmpty(t, srv.DebugAddress(), "must serve debug endpoint")
			if test.StartHTTP {
				require.NotEmpty(t, srv.HTTPAddress(), "must serve http because startHTTP was set")
			} else {
				require.Empty(t, srv.HTTPAddress(), "must not serve http")
			}

			if test.StartGRPC {
				require.NotEmpty(t, srv.GRPCAddress(), "must serve grpc because startGRPC was set")
			} else {
				require.Empty(t, srv.GRPCAddress(), "must not serve grpc")
			}
		})
	}
}

func TestServer_Metrics_gRPC(t *testing.T) {
	ctx := context.Background()
	srv := baseserver.NewForTests(t, baseserver.WithGRPC(baseserver.MustUseRandomLocalAddress(t)))

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

func TestServer_Metrics_HTTP(t *testing.T) {
	srv := baseserver.NewForTests(t, baseserver.WithHTTP(baseserver.MustUseRandomLocalAddress(t)))

	// At this point, there must be metrics registry available for use
	require.NotNil(t, srv.MetricsRegistry())
	// Let's start our server up
	baseserver.StartServerForTests(t, srv)

	_, err := http.Get(fmt.Sprintf("%s/foo/bar", srv.HTTPAddress()))
	require.NoError(t, err)

	registry := srv.MetricsRegistry()

	count, err := testutil.GatherAndCount(registry, "gitpod_http_request_duration_seconds", "gitpod_http_response_size_bytes", "gitpod_http_requests_inflight")
	require.NoError(t, err)
	require.Equal(t, 3, count, "expecting 1 count for each above metric")
}
