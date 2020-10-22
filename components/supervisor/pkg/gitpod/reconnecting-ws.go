// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package gitpod

import (
	"errors"
	"net/http"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gorilla/websocket"
)

// The ReconnectingWebsocket represents a Reconnecting WebSocket connection.
type ReconnectingWebsocket struct {
	url              string
	reqHeader        http.Header
	handshakeTimeout time.Duration

	minReconnectionDelay        time.Duration
	maxReconnectionDelay        time.Duration
	reconnectionDelayGrowFactor float64

	closedCh chan struct{}
	connCh   chan chan *websocket.Conn
	errCh    chan error
}

// NewReconnectingWebsocket creates a new instance of ReconnectingWebsocket
func NewReconnectingWebsocket(url string, reqHeader http.Header) *ReconnectingWebsocket {
	return &ReconnectingWebsocket{
		url:                         url,
		reqHeader:                   reqHeader,
		minReconnectionDelay:        2 * time.Second,
		maxReconnectionDelay:        30 * time.Second,
		reconnectionDelayGrowFactor: 1.5,
		handshakeTimeout:            2 * time.Second,
		connCh:                      make(chan chan *websocket.Conn),
		closedCh:                    make(chan struct{}),
		errCh:                       make(chan error),
	}
}

// Close closes the underlying webscoket connection.
func (rc *ReconnectingWebsocket) Close() error {
	close(rc.closedCh)
	return nil
}

// WriteObject writes the JSON encoding of v as a message.
// See the documentation for encoding/json Marshal for details about the conversion of Go values to JSON.
func (rc *ReconnectingWebsocket) WriteObject(v interface{}) error {
	for {
		connCh := make(chan *websocket.Conn, 1)
		select {
		case <-rc.closedCh:
			return errors.New("closed")
		case rc.connCh <- connCh:
		}
		conn := <-connCh
		err := conn.WriteJSON(v)
		if err == nil {
			return nil
		}
		if !websocket.IsCloseError(err) {
			return err
		}
		select {
		case <-rc.closedCh:
			return errors.New("closed")
		case rc.errCh <- err:
		}
	}
}

// ReadObject reads the next JSON-encoded message from the connection and stores it in the value pointed to by v.
// See the documentation for the encoding/json Unmarshal function for details about the conversion of JSON to a Go value.
func (rc *ReconnectingWebsocket) ReadObject(v interface{}) error {
	for {
		connCh := make(chan *websocket.Conn, 1)
		select {
		case <-rc.closedCh:
			return errors.New("closed")
		case rc.connCh <- connCh:
		}
		conn := <-connCh
		err := conn.ReadJSON(v)
		if err == nil {
			return nil
		}
		if !websocket.IsCloseError(err) {
			return err
		}
		select {
		case <-rc.closedCh:
			return errors.New("closed")
		case rc.errCh <- err:
		}
	}
}

// Dial creates a new client connection.
func (rc *ReconnectingWebsocket) Dial() {
	var conn *websocket.Conn
	defer func() {
		if conn == nil {
			return
		}
		log.WithField("url", rc.url).Warn("connection is permanently closed")
		conn.Close()
	}()

	conn = rc.connect()

	for {
		select {
		case <-rc.closedCh:
			return
		case connCh := <-rc.connCh:
			connCh <- conn
		case err := <-rc.errCh:
			log.WithError(err).WithField("url", rc.url).Warn("connection has been closed, reconnecting...")
			conn.Close()
			conn = rc.connect()
		}
	}
}

func (rc *ReconnectingWebsocket) connect() *websocket.Conn {
	delay := rc.minReconnectionDelay
	for {
		dialer := websocket.Dialer{HandshakeTimeout: rc.handshakeTimeout}
		conn, _, err := dialer.Dial(rc.url, rc.reqHeader)
		if err == nil {
			log.WithField("url", rc.url).Info("connection was successfully established")

			return conn
		}

		log.WithError(err).WithField("url", rc.url).Errorf("failed to connect, trying again in %d seconds...", uint32(delay.Seconds()))
		select {
		case <-rc.closedCh:
			return nil
		case <-time.After(delay):
			delay = time.Duration(float64(delay) * rc.reconnectionDelayGrowFactor)
			if delay > rc.maxReconnectionDelay {
				delay = rc.maxReconnectionDelay
			}
		}
	}
}
