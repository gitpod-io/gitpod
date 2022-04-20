// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package baseserver_test

import (
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
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

func TestServer_ServesReady(t *testing.T) {
	srv := baseserver.NewForTests(t)
	baseserver.StartServerForTests(t, srv)

	readyURL := fmt.Sprintf("%s/ready", srv.HTTPAddress())
	resp, err := http.Get(readyURL)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
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
