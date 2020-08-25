// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package grpcpool

import (
	"strings"
	"sync"

	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"
)

var (
	// ErrPoolClosed is returned if Get is called after Close
	ErrPoolClosed = xerrors.Errorf("pool is closed")
)

// Factory is a function which creates new grpc connections
type Factory func(host string) (*grpc.ClientConn, error)

// Pool is the gRPC client pool
type Pool struct {
	connections map[string]*grpc.ClientConn
	factory     Factory
	closed      bool
	mu          sync.RWMutex
}

// New creates a new connection pool
func New(factory Factory) *Pool {
	return &Pool{
		connections: make(map[string]*grpc.ClientConn),
		factory:     factory,
	}
}

// Get will return a client connection to the host. If no connection exists yet, the factory
// is used to create one.
func (p *Pool) Get(host string) (*grpc.ClientConn, error) {
	p.mu.RLock()
	if p.closed {
		p.mu.RUnlock()
		return nil, ErrPoolClosed
	}
	conn, exists := p.connections[host]
	p.mu.RUnlock()

	if !exists || conn.GetState() == connectivity.Shutdown {
		return p.add(host)
	}

	return conn, nil
}

// add adds a new connection to the host if one doesn't exist already in a state that is not Shutdown.
// Compared to Get, this function holds a write lock on mu. Get uses this function if it cannot find
// an existing connection.
func (p *Pool) add(host string) (*grpc.ClientConn, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	conn, exists := p.connections[host]
	if exists && conn.GetState() != connectivity.Shutdown {
		return conn, nil
	}

	conn, err := p.factory(host)
	if err != nil {
		return nil, err
	}

	p.connections[host] = conn
	return conn, nil
}

// Close empties the pool after closing all connections it held.
// It waits for all connections to close.
// Once the pool is closed, calling Get will result in ErrPoolClosed
func (p *Pool) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.closed = true
	errs := make([]string, 0)
	for _, c := range p.connections {
		err := c.Close()
		if err != nil {
			errs = append(errs, err.Error())
		}
	}

	if len(errs) != 0 {
		return xerrors.Errorf("pool close: %s", strings.Join(errs, "; "))
	}

	return nil
}
