// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package baseserver

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// NewForTests constructs a *baseserver.Server which is automatically closed after the test finishes.
func NewForTests(t *testing.T, opts ...Option) *Server {
	t.Helper()

	defaultTestOpts := []Option{
		WithUnderTest(),
		WithCloseTimeout(1 * time.Second),
	}

	// specified opts override our defaults
	srv, err := New("test_server", append(defaultTestOpts, opts...)...)
	require.NoError(t, err)

	t.Cleanup(func() {
		require.NoError(t, srv.Close())
	})

	return srv
}

func MustUseRandomLocalAddress(t *testing.T) *ServerConfiguration {
	t.Helper()

	return &ServerConfiguration{
		Address: fmt.Sprintf("localhost:%d", MustFindFreePort(t)),
	}
}

func MustFindFreePort(t *testing.T) int {
	t.Helper()

	addr, err := net.ResolveTCPAddr("tcp", "localhost:0")
	if err != nil {
		t.Fatalf("cannot find free port: %v", err)
		return 0
	}

	l, err := net.ListenTCP("tcp", addr)
	if err != nil {
		t.Fatalf("cannot find free port: %v", err)
		return 0
	}
	defer l.Close()

	return l.Addr().(*net.TCPAddr).Port
}

// StartServerForTests starts the server for test purposes.
// This is a helper which also ensures the server is reachable before returning.
func StartServerForTests(t *testing.T, srv *Server) {
	t.Helper()

	go func() {
		err := srv.ListenAndServe()
		require.NoError(t, err)
	}()

	waitForServerToBeReachable(t, srv, 3*time.Second)
}

func waitForServerToBeReachable(t *testing.T, srv *Server, timeout time.Duration) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	tick := 100 * time.Millisecond
	ticker := time.NewTicker(tick)
	defer ticker.Stop()

	client := &http.Client{
		Timeout: tick,
	}

	for {
		healthURL := fmt.Sprintf("%s/ready", srv.HealthAddr())

		select {
		case <-ctx.Done():
			t.Fatalf("server did not become reachable in %s on %s", timeout.String(), healthURL)
		case <-ticker.C:
			// We retrieve the URL on each tick, because the HTTPAddress is only available once the server is listening.
			_, err := client.Get(healthURL)
			if err != nil {
				continue
			}

			// any response means we've managed to reach the server
			return
		}
	}
}
