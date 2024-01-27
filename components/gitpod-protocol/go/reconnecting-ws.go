// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package protocol

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	backoff "github.com/cenkalti/backoff/v4"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

// ErrClosed is returned when the reconnecting web socket is closed.
var ErrClosed = errors.New("reconnecting-ws: closed")

// ErrBadHandshake is returned when the server response to opening handshake is
// invalid.
type ErrBadHandshake struct {
	URL  string
	Resp *http.Response
}

func (e *ErrBadHandshake) Error() string {
	var statusCode int
	if e.Resp != nil {
		statusCode = e.Resp.StatusCode
	}
	return fmt.Sprintf("reconnecting-ws: bad handshake: code %v - URL: %v", statusCode, e.URL)
}

// The ReconnectingWebsocket represents a Reconnecting WebSocket connection.
type ReconnectingWebsocket struct {
	url              string
	reqHeader        http.Header
	handshakeTimeout time.Duration

	once     sync.Once
	closeErr error
	closedCh chan struct{}
	connCh   chan chan *WebsocketConnection
	errCh    chan error

	log *logrus.Entry

	ReconnectionHandler func()

	badHandshakeCount uint8
	badHandshakeMax   uint8
}

// NewReconnectingWebsocket creates a new instance of ReconnectingWebsocket
func NewReconnectingWebsocket(url string, reqHeader http.Header, log *logrus.Entry) *ReconnectingWebsocket {
	return &ReconnectingWebsocket{
		url:               url,
		reqHeader:         reqHeader,
		handshakeTimeout:  2 * time.Second,
		connCh:            make(chan chan *WebsocketConnection),
		closedCh:          make(chan struct{}),
		errCh:             make(chan error),
		log:               log,
		badHandshakeCount: 0,
		badHandshakeMax:   15,
	}
}

// Close closes the underlying webscoket connection.
func (rc *ReconnectingWebsocket) Close() error {
	return rc.closeWithError(ErrClosed)
}

func (rc *ReconnectingWebsocket) closeWithError(closeErr error) error {
	rc.once.Do(func() {
		rc.closeErr = closeErr
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
			return rc.closeErr
		case rc.connCh <- connCh:
		}
		conn := <-connCh
		closed, err := handler(conn)
		if !closed {
			return err
		}
		select {
		case <-rc.closedCh:
			return rc.closeErr
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
func (rc *ReconnectingWebsocket) Dial(ctx context.Context) error {
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
			return rc.closeErr
		case connCh := <-rc.connCh:
			connCh <- conn
		case <-rc.errCh:
			if conn != nil {
				conn.Close()
			}

			time.Sleep(1 * time.Second)
			conn = rc.connect(ctx)
			if conn != nil && rc.ReconnectionHandler != nil {
				go rc.ReconnectionHandler()
			}
		}
	}
}

func (rc *ReconnectingWebsocket) connect(ctx context.Context) *WebsocketConnection {
	exp := &backoff.ExponentialBackOff{
		InitialInterval:     2 * time.Second,
		RandomizationFactor: 0.5,
		Multiplier:          1.5,
		MaxInterval:         30 * time.Second,
		MaxElapsedTime:      0,
		Stop:                backoff.Stop,
		Clock:               backoff.SystemClock,
	}
	exp.Reset()
	for {
		// Gorilla websocket does not check if context is valid when dialing so we do it prior
		select {
		case <-ctx.Done():
			rc.log.WithField("url", rc.url).Debug("context done...closing")
			rc.Close()
			return nil
		default:
		}

		dialer := websocket.Dialer{HandshakeTimeout: rc.handshakeTimeout}
		conn, resp, err := dialer.DialContext(ctx, rc.url, rc.reqHeader)
		if err == nil {
			rc.log.WithField("url", rc.url).Debug("connection was successfully established")
			ws, err := NewWebsocketConnection(context.Background(), conn, func(staleErr error) {
				rc.errCh <- staleErr
			})
			if err == nil {
				rc.badHandshakeCount = 0
				return ws
			}
		}

		var statusCode int
		if resp != nil {
			statusCode = resp.StatusCode
		}

		// 200 is bad gateway for ws, we should keep trying
		if err == websocket.ErrBadHandshake && statusCode != 200 {
			rc.badHandshakeCount++
			// if mal-formed handshake request (unauthorized, forbidden) or client actions (redirect) are required then fail immediately
			// otherwise try several times and fail, maybe temporarily unavailable, like server restart
			if rc.badHandshakeCount > rc.badHandshakeMax || (http.StatusMultipleChoices <= statusCode && statusCode < http.StatusInternalServerError) {
				_ = rc.closeWithError(&ErrBadHandshake{rc.url, resp})
				return nil
			}
		}

		delay := exp.NextBackOff()
		rc.log.WithError(err).
			WithField("url", rc.url).
			WithField("badHandshakeCount", fmt.Sprintf("%d/%d", rc.badHandshakeCount, rc.badHandshakeMax)).
			WithField("statusCode", statusCode).
			WithField("delay", delay.String()).
			Error("failed to connect, trying again...")
		select {
		case <-rc.closedCh:
			return nil
		case <-time.After(delay):
		}
	}
}
