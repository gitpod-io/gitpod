// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package baseserver

import (
	"context"
	"fmt"
	"net/http"
	"strings"
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
		Address: "localhost:0",
	}
}

// StartServerForTests starts the server for test purposes.
// This is a helper which also ensures the server is reachable before returning.
func StartServerForTests(t *testing.T, srv *Server) {
	t.Helper()

	go func() {
		retry := 0
		for ; retry <= 3; retry++ {
			err := srv.ListenAndServe()

			// TODO(gpl) This is a bandaid, because we are experiencing build reliability issues.
			// ":0" should trigger the kernel you choose a free port for us, but somehow this fails. Google points to
			// potential recent kernel bug or tcp4 vs. tcp6 (network stack config) problems.
			// To not waste more energy debugging our build setup her and now, this bandaid to re-try.
			// NOTE: If you ask for a specific port (not ":0"), the test still fails
			if strings.Contains(err.Error(), ":0: bind: address already in use") {
				time.Sleep(time.Millisecond * 200)
				continue
			}

			require.NoError(t, err)
			return
		}
		t.Errorf("Cannot bind to %s after %d retries", srv.options.config.Services.HTTP.Address, retry)
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
