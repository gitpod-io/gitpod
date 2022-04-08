// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package baseserver_test

import (
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/stretchr/testify/require"
	"net/http"
	"sync"
	"testing"
	"time"
)

func TestServer_StartStop(t *testing.T) {
	srv, err := baseserver.New("server_test")
	require.NoError(t, err)

	wg := sync.WaitGroup{}
	wg.Add(1)
	go func() {
		defer wg.Done()
		require.NoError(t, srv.ListenAndServe())
	}()

	require.True(t, srv.WaitForServerToBeReachable(3*time.Second))
	require.NoError(t, srv.Close())
}

func TestServer_Options(t *testing.T) {
	_, err := baseserver.New("server_test",
		baseserver.WithHostname("another_hostname"),
		baseserver.WithHTTPPort(8080),
		baseserver.WithGRPCPort(8081),
		baseserver.WithTLS(baseserver.Certs{
			CACertPath:     "/mnt/ca_cert",
			ServerCertPath: "/mnt/server_cert",
			ServerKeyPath:  "/mnt/server_key",
		}),
		baseserver.WithLogger(log.New()),
	)
	require.NoError(t, err)
}

func TestServer_CancelledContextShutsDownServer(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	srv, err := baseserver.New("test_server", baseserver.WithContext(ctx))
	require.NoError(t, err)

	defer func() {
		require.NoError(t, srv.Close())
	}()

	go func(t *testing.T) {
		require.NoError(t, srv.ListenAndServe())
	}(t)

	require.True(t, srv.WaitForServerToBeReachable(3*time.Second), "server did not start")

	// explicitly cancel our context, we expect the server to terminate
	cancel()

	require.False(t, srv.WaitForServerToBeReachable(1*time.Second))
}

func TestServer_ServesReady(t *testing.T) {
	srv := baseserver.NewForTests(t)

	go func(t *testing.T) {
		require.NoError(t, srv.ListenAndServe())
	}(t)

	require.True(t, srv.WaitForServerToBeReachable(3*time.Second), "server did not start")

	readyUR := fmt.Sprintf("%s/ready", srv.HTTPAddress())
	resp, err := http.Get(readyUR)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestServer_ServesMetrics(t *testing.T) {
	srv := baseserver.NewForTests(t)

	go func(t *testing.T) {
		require.NoError(t, srv.ListenAndServe())
	}(t)

	require.True(t, srv.WaitForServerToBeReachable(3*time.Second), "server did not start")

	metricsURL := fmt.Sprintf("%s/metrics", srv.HTTPAddress())
	resp, err := http.Get(metricsURL)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
}
