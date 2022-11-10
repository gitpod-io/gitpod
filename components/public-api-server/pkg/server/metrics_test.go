// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

func TestMetricsInterceptor(t *testing.T) {
	reg := prometheus.NewRegistry()
	metrics := NewConnectMetrics()
	require.NoError(t, metrics.Register(reg))

	interceptor := NewMetricsInterceptor(metrics)

	_, handler := v1connect.NewWorkspacesServiceHandler(&v1connect.UnimplementedWorkspacesServiceHandler{}, connect.WithInterceptors(interceptor))

	srv := httptest.NewServer(handler)

	client := v1connect.NewWorkspacesServiceClient(http.DefaultClient, srv.URL, connect.WithInterceptors(interceptor))

	_, _ = client.GetWorkspace(context.Background(), connect.NewRequest(&v1.GetWorkspaceRequest{
		WorkspaceId: "123",
	}))

	expectedMetrics := []string{"connect_server_started_total", "connect_server_handled_seconds", "connect_client_started_total", "connect_client_handled_seconds"}
	count, err := testutil.GatherAndCount(reg, expectedMetrics...)
	require.NoError(t, err)
	require.Equal(t, len(expectedMetrics), count, "must expose all expected metrics")
}
