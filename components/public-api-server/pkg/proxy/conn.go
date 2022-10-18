// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"fmt"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus/ctxlogrus"
	"net/url"
	"time"
)

type ServerConnectionPool interface {
	// Get retrieves or creates a new connection for the specified token
	// Connections must not be shared across tokens
	Get(ctx context.Context, token string) (gitpod.APIInterface, error)
}

// NoConnectionPool is a simple version of the ServerConnectionPool which always creates a new connection.
type NoConnectionPool struct {
	ServerAPI *url.URL
}

func (p *NoConnectionPool) Get(ctx context.Context, token string) (gitpod.APIInterface, error) {
	logger := ctxlogrus.Extract(ctx)

	start := time.Now()
	defer func() {
		reportConnectionDuration(time.Since(start))
	}()
	server, err := gitpod.ConnectToServer(p.ServerAPI.String(), gitpod.ConnectToServerOpts{
		Context: ctx,
		Token:   token,
		Log:     logger,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create new connection to server: %w", err)
	}

	return server, nil
}
