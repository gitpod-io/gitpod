// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package sshproxy

import (
	"io"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/analytics"
	"github.com/gitpod-io/gitpod/common-go/log"
	tracker "github.com/gitpod-io/gitpod/ws-proxy/pkg/analytics"
	"github.com/gitpod-io/golang-crypto/ssh"
	"golang.org/x/net/context"
)

func (s *Server) ChannelForward(ctx context.Context, session *Session, targetConn ssh.Conn, originChannel ssh.NewChannel) {
	targetChan, targetReqs, err := targetConn.OpenChannel(originChannel.ChannelType(), originChannel.ExtraData())
	if err != nil {
		log.WithFields(log.OWI("", session.WorkspaceID, session.InstanceID)).Error("open target channel error")
		_ = originChannel.Reject(ssh.ConnectionFailed, "open target channel error")
		return
	}
	defer targetChan.Close()

	originChan, originReqs, err := originChannel.Accept()
	if err != nil {
		log.WithFields(log.OWI("", session.WorkspaceID, session.InstanceID)).Error("accept origin channel failed")
		return
	}
	if originChannel.ChannelType() == "session" {
		originChan = startHeartbeatingChannel(originChan, s.Heartbeater, session)
	}
	defer originChan.Close()

	maskedReqs := make(chan *ssh.Request, 1)

	go func() {
		for req := range originReqs {
			switch req.Type {
			case "pty-req", "shell":
				log.WithFields(log.OWI("", session.WorkspaceID, session.InstanceID)).Debugf("forwarding %s request", req.Type)
				if channel, ok := originChan.(*heartbeatingChannel); ok && req.Type == "pty-req" {
					channel.mux.Lock()
					channel.requestedPty = true
					channel.mux.Unlock()
				}
			}
			maskedReqs <- req
		}
		close(maskedReqs)
	}()

	originChannelWg := sync.WaitGroup{}
	originChannelWg.Add(3)
	targetChannelWg := sync.WaitGroup{}
	targetChannelWg.Add(3)

	wg := sync.WaitGroup{}
	wg.Add(2)

	go func() {
		defer wg.Done()
		_, _ = io.Copy(targetChan, originChan)
		targetChannelWg.Done()
		targetChannelWg.Wait()
		_ = targetChan.Close()
	}()

	go func() {
		defer wg.Done()
		_, _ = io.Copy(originChan, targetChan)
		originChannelWg.Done()
		originChannelWg.Wait()
		_ = originChan.Close()
	}()

	go func() {
		_, _ = io.Copy(targetChan.Stderr(), originChan.Stderr())
		targetChannelWg.Done()
	}()

	go func() {
		_, _ = io.Copy(originChan.Stderr(), targetChan.Stderr())
		originChannelWg.Done()
	}()

	forward := func(sourceReqs <-chan *ssh.Request, targetChan ssh.Channel, channelWg *sync.WaitGroup) {
		defer channelWg.Done()
		for ctx.Err() == nil {
			select {
			case req, ok := <-sourceReqs:
				if !ok {
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

	go forward(maskedReqs, targetChan, &targetChannelWg)
	go forward(targetReqs, originChan, &originChannelWg)

	wg.Wait()
	log.WithFields(log.OWI("", session.WorkspaceID, session.InstanceID)).Debug("session forward stop")
}

func TrackIDECloseSignal(session *Session) {
	propertics := make(map[string]interface{})
	propertics["workspaceId"] = session.WorkspaceID
	propertics["instanceId"] = session.InstanceID
	propertics["clientKind"] = "ssh"
	tracker.Track(analytics.TrackMessage{
		Identity:   analytics.Identity{UserID: session.OwnerUserId},
		Event:      "ide_close_signal",
		Properties: propertics,
	})
}

func startHeartbeatingChannel(c ssh.Channel, heartbeat Heartbeat, session *Session) ssh.Channel {
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
				if !res.sawActivity || !res.requestedPty {
					res.mux.Unlock()
					continue
				}
				res.sawActivity = false
				res.mux.Unlock()
				heartbeat.SendHeartbeat(session.InstanceID, false, false)
			case <-ctx.Done():
				if res.requestedPty {
					heartbeat.SendHeartbeat(session.InstanceID, true, false)
					TrackIDECloseSignal(session)
					log.WithField("instanceId", session.InstanceID).Info("send closed heartbeat")
				}
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

	requestedPty bool
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
