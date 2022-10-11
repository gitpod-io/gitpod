// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus/ctxlogrus"

	lru "github.com/hashicorp/golang-lru"
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

func NewConnectionPool(address *url.URL, poolSize int) (*ConnectionPool, error) {
	cache, err := lru.NewWithEvict(poolSize, func(_, value interface{}) {
		connectionPoolSize.Dec()

		// We attempt to gracefully close the connection
		conn, ok := value.(gitpod.APIInterface)
		if !ok {
			log.Errorf("Failed to cast cache value to gitpod API Interface")
			return
		}

		closeErr := conn.Close()
		if closeErr != nil {
			log.Log.WithError(closeErr).Warn("Failed to close connection to server.")
		}
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create LRU cache: %w", err)
	}

	return &ConnectionPool{
		cache: cache,
		connConstructor: func(token string) (gitpod.APIInterface, error) {
			return gitpod.ConnectToServer(address.String(), gitpod.ConnectToServerOpts{
				// We're using Background context as we want the connection to persist beyond the lifecycle of a single request
				Context: context.Background(),
				Token:   token,
				Log:     log.Log,
				CloseHandler: func(_ error) {
					cache.Remove(token)
					connectionPoolSize.Dec()
				},
			})
		},
	}, nil

}

type ConnectionPool struct {
	connConstructor func(token string) (gitpod.APIInterface, error)

	// cache stores token to connection mapping
	cache *lru.Cache
}

func (p *ConnectionPool) Get(ctx context.Context, token string) (gitpod.APIInterface, error) {
	cached, found := p.cache.Get(token)
	reportCacheOutcome(found)
	if found {
		conn, ok := cached.(*gitpod.APIoverJSONRPC)
		if ok {
			return conn, nil
		}
	}

	conn, err := p.connConstructor(token)
	if err != nil {
		return nil, fmt.Errorf("failed to create new connection to server: %w", err)
	}

	p.cache.Add(token, conn)
	connectionPoolSize.Inc()

	return conn, nil
}
