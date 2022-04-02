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
	"time"
)

func TestServer_StartStop(t *testing.T) {
	// We don't use the helper NewForTests, because we want to control stopping ourselves.
	srv, err := baseserver.New("server_test")
	require.NoError(t, err)

	go func() {
		require.NoError(t, srv.ListenAndServe())
	}()

	baseserver.WaitForServerToBeReachable(t, srv, 3*time.Second)
	require.NoError(t, srv.Close())
}

func TestServer_ServesReady(t *testing.T) {
	srv := baseserver.NewForTests(t)

	go func(t *testing.T) {
		require.NoError(t, srv.ListenAndServe())
	}(t)

	baseserver.WaitForServerToBeReachable(t, srv, 3*time.Second)

	readyUR := fmt.Sprintf("%s/ready", srv.HTTPAddress())
	resp, err := http.Get(readyUR)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestServer_ServesMetricsEndpointWithDefaultConfig(t *testing.T) {
	srv := baseserver.NewForTests(t)

	go func(t *testing.T) {
		require.NoError(t, srv.ListenAndServe())
	}(t)

	baseserver.WaitForServerToBeReachable(t, srv, 3*time.Second)

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

	go func(t *testing.T) {
		require.NoError(t, srv.ListenAndServe())
	}(t)

	baseserver.WaitForServerToBeReachable(t, srv, 3*time.Second)

	readyUR := fmt.Sprintf("%s/metrics", srv.HTTPAddress())
	resp, err := http.Get(readyUR)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
}
