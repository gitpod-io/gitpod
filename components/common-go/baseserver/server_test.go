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

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()
	require.NoError(t, srv.Close(ctx))
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

func TestServer_ServesMetrics(t *testing.T) {
	srv, err := baseserver.New("server_test")
	require.NoError(t, err)

	go func(t *testing.T) {
		require.NoError(t, srv.ListenAndServe())
	}(t)

	ctx, _ := context.WithTimeout(context.Background(), 20*time.Second)
	require.True(t, srv.WaitForServerToBeReachable(ctx), "server did not start")

	metricsURL := fmt.Sprintf("%s/metrics", srv.HTTPAddress())
	resp, err := http.Get(metricsURL)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
}
