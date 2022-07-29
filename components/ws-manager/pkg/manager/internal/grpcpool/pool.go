// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package grpcpool

import (
	"fmt"
	"sync"

	conn_pool "github.com/shimingyah/pool"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
)

var (
	// ErrPoolClosed is returned if Get is called after Close
	ErrPoolClosed = fmt.Errorf("pool is closed")
	// ErrNoWSDaemonFoundInPool is returned is there is no ws-daemon pod in the host
	ErrNoWSDaemonFoundInPool = fmt.Errorf("no ws-daemon found in the host")
)

// Dial is a function which creates new grpc connections
type Dial func(host string) (*grpc.ClientConn, error)

// Pool is the gRPC client pool
type Pool struct {
	dial     Dial
	isClosed bool

	pools sync.Map
}

// New creates a new connection pool
func New(dial Dial) *Pool {
	pool := &Pool{
		dial: dial,
	}

	return pool
}

// Get will return a client connection to the host. If no connection exists yet, the factory
// is used to create one.
func (p *Pool) Get(host string) (*grpc.ClientConn, error) {
	if p.isClosed {
		return nil, ErrPoolClosed
	}

	conn, exists := p.pools.Load(host)
	if !exists {
		return nil, ErrNoWSDaemonFoundInPool
	}

	connPool, exists := conn.(conn_pool.Pool)
	if !exists {
		return nil, ErrNoWSDaemonFoundInPool
	}

	c, err := connPool.Get()
	if err != nil {
		return nil, xerrors.Errorf("cannot create connection to ws-daemon: %w", err)
	}

	return c.Value(), nil
}

// add adds a new connection to the host if one doesn't exist already in a state that is not Shutdown.
// Compared to Get, this function holds a write lock on mu. Get uses this function if it cannot find
// an existing connection.
func (p *Pool) Add(host, address string) error {
	_, exists := p.pools.Load(host)
	if exists {
		return nil
	}

	connPool, err := conn_pool.New(address, conn_pool.Options{
		Dial:                 p.dial,
		MaxIdle:              8,
		MaxActive:            64,
		MaxConcurrentStreams: 64,
		Reuse:                false,
	})
	if err != nil {
		return err
	}

	p.pools.Store(host, connPool)

	_, err = connPool.Get()
	if err != nil {
		return err
	}

	return nil
}

func (p *Pool) Remove(host string) error {
	conn, exists := p.pools.Load(host)
	if !exists {
		return nil
	}

	connPool, exists := conn.(conn_pool.Pool)
	if !exists {
		return nil
	}

	return connPool.Close()
}

// Stop empties the pool after closing all connections it held.
// It waits for all connections to close.
// Once the pool is closed, calling Get will result in ErrPoolClosed
func (p *Pool) Stop() {
	if p.isClosed {
		return
	}

	p.pools.Range(func(key, value any) bool {
		host := key.(string)
		conn := value.(conn_pool.Pool)
		p.pools.Delete(host)
		_ = conn.Close()
		return true
	})

	p.isClosed = true
}
