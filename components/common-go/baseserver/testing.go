// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package baseserver

import (
	"context"
	"fmt"
	"github.com/stretchr/testify/require"
	"net/http"
	"testing"
	"time"
)

// NewForTests constructs a *baseserver.Server which is automatically closed after the test finishes.
func NewForTests(t *testing.T, opts ...Option) *Server {
	t.Helper()

	defaultTestOpts := []Option{
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

func WaitForServerToBeReachable(t *testing.T, srv *Server, timeout time.Duration) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	tick := 100 * time.Millisecond
	ticker := time.NewTicker(tick)
	defer ticker.Stop()

	client := &http.Client{
		Timeout: tick,
	}

	healthURL := fmt.Sprintf("%s/ready", srv.HTTPAddress())

	for {
		select {
		case <-ctx.Done():
			require.Failf(t, "server did not become reachable in %s", timeout.String())
		case <-ticker.C:
			_, err := client.Get(healthURL)
			if err != nil {
				continue
			}

			// any response means we've managed to reach the server
			return
		}
	}
}
