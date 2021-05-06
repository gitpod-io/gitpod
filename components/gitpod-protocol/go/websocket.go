// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2020 Jaime Pillora <dev@jpillora.com>. All rights reserved.
 *  Licensed under the MIT License. See https://github.com/jpillora/chisel/blob/7aa0da95db178b8bc4f20ab49128368348fd4410/LICENSE for license information.
 *--------------------------------------------------------------------------------------------*/
// copied and modified from https://github.com/jpillora/chisel/blob/33fa2010abd42ec76ed9011995f5240642b1a3c5/share/cnet/conn_ws.go
package protocol

import (
	"context"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type WebsocketConnection struct {
	*websocket.Conn
	buff []byte

	Ctx    context.Context
	cancel func()

	once     sync.Once
	closeErr error
	waitDone chan struct{}
}

var (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 15 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10
)

//NewWebsocketConnection converts a websocket.Conn into a net.Conn
func NewWebsocketConnection(ctx context.Context, websocketConn *websocket.Conn, onStale func(staleErr error)) (*WebsocketConnection, error) {
	ctx, cancel := context.WithCancel(ctx)
	c := &WebsocketConnection{
		Conn:     websocketConn,
		waitDone: make(chan struct{}),
		Ctx:      ctx,
		cancel:   cancel,
	}
	err := c.SetReadDeadline(time.Now().Add(pongWait))
	if err != nil {
		return nil, err
	}
	c.SetPongHandler(func(string) error { c.SetReadDeadline(time.Now().Add(pongWait)); return nil })

	go func() {
		defer c.Close()
		ticker := time.NewTicker(pingPeriod)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				staleErr := c.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(writeWait))
				if staleErr != nil {
					onStale(staleErr)
					return
				}
			}
		}
	}()
	return c, nil
}

// Close closes the connection
func (c *WebsocketConnection) Close() error {
	c.once.Do(func() {
		c.cancel()
		c.closeErr = c.Conn.Close()
		close(c.waitDone)
	})
	return c.closeErr
}

// Wait waits till the connection is closed.
func (c *WebsocketConnection) Wait() error {
	<-c.waitDone
	return c.closeErr
}

//Read is not threadsafe though thats okay since there
//should never be more than one reader
func (c *WebsocketConnection) Read(dst []byte) (int, error) {
	ldst := len(dst)
	//use buffer or read new message
	var src []byte
	if len(c.buff) > 0 {
		src = c.buff
		c.buff = nil
	} else if _, msg, err := c.Conn.ReadMessage(); err == nil {
		src = msg
	} else {
		return 0, err
	}
	//copy src->dest
	var n int
	if len(src) > ldst {
		//copy as much as possible of src into dst
		n = copy(dst, src[:ldst])
		//copy remainder into buffer
		r := src[ldst:]
		lr := len(r)
		c.buff = make([]byte, lr)
		copy(c.buff, r)
	} else {
		//copy all of src into dst
		n = copy(dst, src)
	}
	//return bytes copied
	return n, nil
}

func (c *WebsocketConnection) Write(b []byte) (int, error) {
	err := c.Conn.WriteMessage(websocket.BinaryMessage, b)
	if err != nil {
		return 0, err
	}
	n := len(b)
	return n, nil
}

func (c *WebsocketConnection) SetDeadline(t time.Time) error {
	if err := c.Conn.SetReadDeadline(t); err != nil {
		return err
	}
	return c.Conn.SetWriteDeadline(t)
}
