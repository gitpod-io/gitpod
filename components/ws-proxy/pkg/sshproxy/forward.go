// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package sshproxy

import (
	"io"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/golang-crypto/ssh"
	"golang.org/x/net/context"
)

func (s *Server) ChannelForward(ctx context.Context, session *Session, targetConn ssh.Conn, originChannel ssh.NewChannel) {
	targetChan, targetReqs, err := targetConn.OpenChannel(originChannel.ChannelType(), originChannel.ExtraData())
	if err != nil {
		log.WithFields(log.OWI("", session.WorkspaceID, session.InstanceID)).Error("open target channel error")
		originChannel.Reject(ssh.ConnectionFailed, "open target channel error")
		return
	}
	defer targetChan.Close()

	originChan, originReqs, err := originChannel.Accept()
	if err != nil {
		log.WithFields(log.OWI("", session.WorkspaceID, session.InstanceID)).Error("accept origin channel failed")
		return
	}
	if originChannel.ChannelType() == "session" {
		originChan = startHeartbeatingChannel(originChan, s.Heartbeater, session.InstanceID)
	}
	defer originChan.Close()

	maskedReqs := make(chan *ssh.Request, 1)

	go func() {
		for req := range originReqs {
			switch req.Type {
			case "pty-req", "shell":
				log.WithFields(log.OWI("", session.WorkspaceID, session.InstanceID)).Debugf("forwarding %s request", req.Type)
				if req.WantReply {
					req.Reply(true, []byte{})
					req.WantReply = false
				}
			}
			maskedReqs <- req
		}
		close(maskedReqs)
	}()

	go func() {
		io.Copy(targetChan, originChan)
		targetChan.CloseWrite()
	}()

	go func() {
		io.Copy(originChan, targetChan)
		originChan.CloseWrite()
	}()

	wg := sync.WaitGroup{}
	forward := func(sourceReqs <-chan *ssh.Request, targetChan ssh.Channel) {
		defer wg.Done()
		for ctx.Err() == nil {
			select {
			case req, ok := <-sourceReqs:
				if !ok {
					targetChan.Close()
					return
				}
				b, err := targetChan.SendRequest(req.Type, req.WantReply, req.Payload)
				_ = req.Reply(b, nil)
				if err != nil {
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}

	wg.Add(2)
	go forward(maskedReqs, targetChan)
	go forward(targetReqs, originChan)

	wg.Wait()
	log.WithFields(log.OWI("", session.WorkspaceID, session.InstanceID)).Debug("session forward stop")
}

func startHeartbeatingChannel(c ssh.Channel, heartbeat Heartbeat, instanceID string) ssh.Channel {
	ctx, cancel := context.WithCancel(context.Background())
	res := &heartbeatingChannel{
		Channel: c,
		t:       time.NewTicker(30 * time.Second),
		cancel:  cancel,
	}
	go func() {
		for {
			select {
			case <-res.t.C:
				res.mux.Lock()
				if !res.sawActivity {
					res.mux.Unlock()
					continue
				}
				res.sawActivity = false
				res.mux.Unlock()
				heartbeat.SendHeartbeat(instanceID, false)
			case <-ctx.Done():
				heartbeat.SendHeartbeat(instanceID, true)
				return
			}
		}
	}()

	return res
}

type heartbeatingChannel struct {
	ssh.Channel

	mux         sync.Mutex
	sawActivity bool
	t           *time.Ticker

	cancel context.CancelFunc
}

// Read reads up to len(data) bytes from the channel.
func (c *heartbeatingChannel) Read(data []byte) (written int, err error) {
	written, err = c.Channel.Read(data)
	if err == nil && written != 0 {
		c.mux.Lock()
		c.sawActivity = true
		c.mux.Unlock()
	}
	return
}

func (c *heartbeatingChannel) Close() error {
	c.t.Stop()
	c.cancel()
	return c.Channel.Close()
}
