// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ratelimit

import (
	"context"
	"net"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/time/rate"
)

// Listener adds rate limiting to the Accept function
// and delegates all requests to net.Listener.
type Listener struct {
	delegate    net.Listener
	ctx         context.Context
	ratelimiter *rate.Limiter
}

// Accept waits for and returns the next connection to the listener.
// This implemenation delegates to net.Listener and adds rate limiting.
func (rll *Listener) Accept() (conn net.Conn, err error) {
	conn, err = rll.delegate.Accept()
	if err != nil {
		return
	}
	err = rll.ratelimiter.Wait(rll.ctx)
	if err != nil {
		log.
			WithError(err).
			WithField("remote addr", conn.RemoteAddr()).
			Info("Listener: error from ratelimiter")
	}
	return
}

// Close closes the listener.
// Any blocked Accept operations will be unblocked and return errors.
// This implemenation delegates to net.Listener.
func (rll *Listener) Close() error {
	return rll.delegate.Close()
}

// Addr returns the listener's network address.
// This implemenation delegates to net.Listener.
func (rll *Listener) Addr() net.Addr {
	return rll.delegate.Addr()
}

// NewListener creates a net.Listener implementation that adds rate limiting.
func NewListener(ctx context.Context, network, address string, refillInterval time.Duration, bucketSize int) (*Listener, error) {
	l, err := net.Listen(network, address)
	if err != nil {
		return nil, err
	}
	rll := &Listener{
		delegate:    l,
		ctx:         ctx,
		ratelimiter: rate.NewLimiter(rate.Every(time.Duration(refillInterval)), bucketSize),
	}
	return rll, nil
}
