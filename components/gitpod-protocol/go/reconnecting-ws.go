// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package protocol

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

// The ReconnectingWebsocket represents a Reconnecting WebSocket connection.
type ReconnectingWebsocket struct {
	url              string
	reqHeader        http.Header
	handshakeTimeout time.Duration

	minReconnectionDelay        time.Duration
	maxReconnectionDelay        time.Duration
	reconnectionDelayGrowFactor float64

	once     sync.Once
	closedCh chan struct{}
	connCh   chan chan *WebsocketConnection
	errCh    chan error

	log *logrus.Entry

	ReconnectionHandler func()
}

// NewReconnectingWebsocket creates a new instance of ReconnectingWebsocket
func NewReconnectingWebsocket(url string, reqHeader http.Header, log *logrus.Entry) *ReconnectingWebsocket {
	return &ReconnectingWebsocket{
		url:                         url,
		reqHeader:                   reqHeader,
		minReconnectionDelay:        2 * time.Second,
		maxReconnectionDelay:        30 * time.Second,
		reconnectionDelayGrowFactor: 1.5,
		handshakeTimeout:            2 * time.Second,
		connCh:                      make(chan chan *WebsocketConnection),
		closedCh:                    make(chan struct{}),
		errCh:                       make(chan error),
		log:                         log,
	}
}

// Close closes the underlying webscoket connection.
func (rc *ReconnectingWebsocket) Close() error {
	rc.once.Do(func() {
		close(rc.closedCh)
	})
	return nil
}

// EnsureConnection ensures ws connections
// Returns only if connection is permanently failed
// If the passed handler returns false as closed then err is returned to the client,
// otherwise err is treated as a connection error, and new conneciton is provided.
func (rc *ReconnectingWebsocket) EnsureConnection(handler func(conn *WebsocketConnection) (closed bool, err error)) error {
	for {
		connCh := make(chan *WebsocketConnection, 1)
		select {
		case <-rc.closedCh:
			return errors.New("closed")
		case rc.connCh <- connCh:
		}
		conn := <-connCh
		closed, err := handler(conn)
		if !closed {
			return err
		}
		select {
		case <-rc.closedCh:
			return errors.New("closed")
		case rc.errCh <- err:
		}
	}
}

func isJSONError(err error) bool {
	_, isJsonErr := err.(*json.MarshalerError)
	if isJsonErr {
		return true
	}
	_, isJsonErr = err.(*json.SyntaxError)
	if isJsonErr {
		return true
	}
	_, isJsonErr = err.(*json.UnsupportedTypeError)
	if isJsonErr {
		return true
	}
	_, isJsonErr = err.(*json.UnsupportedValueError)
	return isJsonErr
}

// WriteObject writes the JSON encoding of v as a message.
// See the documentation for encoding/json Marshal for details about the conversion of Go values to JSON.
func (rc *ReconnectingWebsocket) WriteObject(v interface{}) error {
	return rc.EnsureConnection(func(conn *WebsocketConnection) (bool, error) {
		err := conn.WriteJSON(v)
		closed := err != nil && !isJSONError(err)
		return closed, err
	})
}

// ReadObject reads the next JSON-encoded message from the connection and stores it in the value pointed to by v.
// See the documentation for the encoding/json Unmarshal function for details about the conversion of JSON to a Go value.
func (rc *ReconnectingWebsocket) ReadObject(v interface{}) error {
	return rc.EnsureConnection(func(conn *WebsocketConnection) (bool, error) {
		err := conn.ReadJSON(v)
		closed := err != nil && !isJSONError(err)
		return closed, err
	})
}

// Dial creates a new client connection.
func (rc *ReconnectingWebsocket) Dial() {
	rc.DialContext(context.Background())
}

// DialContext creates a new client connection with a context
func (rc *ReconnectingWebsocket) DialContext(ctx context.Context) {
	var conn *WebsocketConnection
	defer func() {
		if conn == nil {
			return
		}
		rc.log.WithField("url", rc.url).Debug("connection is permanently closed")
		conn.Close()
	}()

	conn = rc.connect(ctx)

	for {
		select {
		case <-rc.closedCh:
			return
		case connCh := <-rc.connCh:
			connCh <- conn
		case <-rc.errCh:
			conn.Close()

			time.Sleep(1 * time.Second)
			conn = rc.connect(ctx)
			if conn != nil && rc.ReconnectionHandler != nil {
				go rc.ReconnectionHandler()
			}
		}
	}
}

func (rc *ReconnectingWebsocket) connect(ctx context.Context) *WebsocketConnection {
	delay := rc.minReconnectionDelay
	for {
		// Gorilla websocket does not check if context is valid when dialing so we do it prior
		select {
		case <-ctx.Done():
			rc.log.WithField("url", rc.url).Info("context done...closing")
			rc.Close()
			return nil
		default:
		}

		dialer := websocket.Dialer{HandshakeTimeout: rc.handshakeTimeout}
		conn, _, err := dialer.DialContext(ctx, rc.url, rc.reqHeader)
		if err == nil {
			rc.log.WithField("url", rc.url).Debug("connection was successfully established")
			ws, err := NewWebsocketConnection(context.Background(), conn, func(staleErr error) {
				rc.errCh <- staleErr
			})
			if err == nil {
				return ws
			}
		}

		rc.log.WithError(err).WithField("url", rc.url).Errorf("failed to connect, trying again in %d seconds...", uint32(delay.Seconds()))
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
