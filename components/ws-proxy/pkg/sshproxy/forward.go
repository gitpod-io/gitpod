// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package sshproxy

import (
	"io"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/crypto/ssh"
	"golang.org/x/net/context"
)

func (s *Server) ChannelForward(ctx context.Context, session *Session, client *ssh.Client, newChannel ssh.NewChannel) {
	workspaceChan, workspaceReqs, err := client.OpenChannel(newChannel.ChannelType(), newChannel.ExtraData())
	if err != nil {
		log.WithFields(log.OWI("", session.WorkspaceID, session.InstanceID)).Error("open workspace channel error")
		newChannel.Reject(ssh.ConnectionFailed, "open workspace channel error")
		return
	}
	defer workspaceChan.Close()

	clientChan, clientReqs, err := newChannel.Accept()
	if err != nil {
		log.WithFields(log.OWI("", session.WorkspaceID, session.InstanceID)).Error("accept new channel failed")
		return
	}
	if newChannel.ChannelType() == "session" {
		clientChan = startHeartbeatingChannel(clientChan, s.Heartbeater, session.InstanceID)
	}
	defer clientChan.Close()

	maskedReqs := make(chan *ssh.Request, 1)

	go func() {
		for req := range clientReqs {
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
		io.Copy(workspaceChan, clientChan)
		workspaceChan.CloseWrite()
	}()

	go func() {
		io.Copy(clientChan, workspaceChan)
		clientChan.CloseWrite()
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
	go forward(maskedReqs, workspaceChan)
	go forward(workspaceReqs, clientChan)

	wg.Wait()
	log.WithFields(log.OWI("", session.WorkspaceID, session.InstanceID)).Debug("session forward stop")
}

func startHeartbeatingChannel(c ssh.Channel, heartbeat Heartbeat, instanceID string) ssh.Channel {
	res := &heartbeatingChannel{
		Channel: c,
		t:       time.NewTimer(30 * time.Second),
	}
	go func() {
		for range res.t.C {
			res.mux.Lock()
			if !res.sawActivity {
				res.mux.Unlock()
				continue
			}
			res.sawActivity = false
			res.mux.Unlock()

			heartbeat.SendHeartbeat(instanceID)
		}
	}()

	return res
}

type heartbeatingChannel struct {
	ssh.Channel

	mux         sync.Mutex
	sawActivity bool
	t           *time.Timer
}

// Read reads up to len(data) bytes from the channel.
func (c *heartbeatingChannel) Read(data []byte) (int, error) {
	c.mux.Lock()
	c.sawActivity = true
	c.mux.Unlock()
	return c.Channel.Read(data)
}

func (c *heartbeatingChannel) Close() error {
	c.t.Stop()
	return c.Channel.Close()
}
