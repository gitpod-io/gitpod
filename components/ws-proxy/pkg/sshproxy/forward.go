// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package sshproxy

import (
	"fmt"
	"io"
	"net"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"golang.org/x/crypto/ssh"
	"golang.org/x/net/context"
)

const GitpodUsername = "gitpod"

func proxy(reqs1, reqs2 <-chan *ssh.Request, channel1, channel2 ssh.Channel) {
	var closer sync.Once
	closeFunc := func() {
		channel1.Close()
		channel2.Close()
	}

	defer closer.Do(closeFunc)

	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		io.Copy(channel1, channel2)
		cancel()
	}()

	go func() {
		io.Copy(channel2, channel1)
		cancel()
	}()

	for {
		select {
		case req := <-reqs1:
			if req == nil {
				return
			}
			b, err := channel2.SendRequest(req.Type, req.WantReply, req.Payload)
			if err != nil {
				return
			}
			req.Reply(b, nil)
		case req := <-reqs2:
			if req == nil {
				return
			}
			b, err := channel1.SendRequest(req.Type, req.WantReply, req.Payload)
			if err != nil {
				return
			}
			req.Reply(b, nil)
		case <-ctx.Done():
			return
		}
	}
}

func (s *Server) ChannelForward(session *Session, newChannel ssh.NewChannel) {
	clientConfig := &ssh.ClientConfig{
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		User:            GitpodUsername,
		Auth: []ssh.AuthMethod{
			ssh.PublicKeysCallback(func() (signers []ssh.Signer, err error) {
				return []ssh.Signer{session.WorkspacePrivateKey}, nil
			}),
		},
		Timeout: 10 * time.Second,
	}

	if s.ConnectionTimeout != 0 {
		clientConfig.Timeout = s.ConnectionTimeout
	}

	conn, err := net.Dial("tcp", session.WorkspaceIP)
	if err != nil {
		newChannel.Reject(ssh.ConnectionFailed, fmt.Sprintf("Connect failed: %v\r\n", err))
		return
	}
	defer conn.Close()

	clientConn, clientChans, clientReqs, err := ssh.NewClientConn(conn, session.WorkspaceIP, clientConfig)
	if err != nil {
		newChannel.Reject(ssh.ConnectionFailed, fmt.Sprintf("Client connection setup failed: %v\r\n", err))
		return
	}
	client := ssh.NewClient(clientConn, clientChans, clientReqs)

	directTCPIPChannel, _, err := client.OpenChannel("direct-tcpip", newChannel.ExtraData())
	if err != nil {
		newChannel.Reject(ssh.ConnectionFailed, fmt.Sprintf("Remote session setup failed: %v\r\n", err))
		return
	}

	channel, reqs, err := newChannel.Accept()
	if err != nil {
		return
	}

	go ssh.DiscardRequests(reqs)
	var closer sync.Once
	closeFunc := func() {
		channel.Close()
		directTCPIPChannel.Close()
		client.Close()
	}

	go func() {
		io.Copy(channel, directTCPIPChannel)
		closer.Do(closeFunc)
	}()

	io.Copy(directTCPIPChannel, channel)
	closer.Do(closeFunc)
}

func (s *Server) SessionForward(session *Session, newChannel ssh.NewChannel) {
	sessChan, sessReqs, err := newChannel.Accept()
	if err != nil {
		log.WithError(err).Error("SessionForward accept failed")
		return
	}
	defer sessChan.Close()

	maskedReqs := make(chan *ssh.Request, 1)
	go func() {
		for req := range sessReqs {
			switch req.Type {
			case "pty-req", "shell":
				log.WithFields(log.OWI("", session.WorkspaceID, session.InstanceID)).Debugf("forwarding %s request", req.Type)
				if req.WantReply {
					req.Reply(true, []byte{})
					req.WantReply = false
				}
			case "keepalive@openssh.com":
				if req.WantReply {
					req.Reply(true, []byte{})
					req.WantReply = false
				}
			}
			maskedReqs <- req
		}
	}()

	stderr := sessChan.Stderr()

	clientConfig := &ssh.ClientConfig{
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		User:            GitpodUsername,
		Auth: []ssh.AuthMethod{
			ssh.PublicKeysCallback(func() (signers []ssh.Signer, err error) {
				return []ssh.Signer{session.WorkspacePrivateKey}, nil
			}),
		},
		Timeout: 10 * time.Second,
	}

	if s.ConnectionTimeout != 0 {
		clientConfig.Timeout = s.ConnectionTimeout
	}

	conn, err := net.Dial("tcp", session.WorkspaceIP)
	if err != nil {
		fmt.Fprintf(stderr, "Connect failed: %v\r\n", err)
		return
	}
	defer conn.Close()

	clientConn, clientChans, clientReqs, err := ssh.NewClientConn(conn, session.WorkspaceIP, clientConfig)
	if err != nil {
		fmt.Fprintf(stderr, "Client connection setup failed: %v\r\n", err)
		return
	}
	client := ssh.NewClient(clientConn, clientChans, clientReqs)

	forwardChannel, forwardReqs, err := client.OpenChannel("session", []byte{})
	if err != nil {
		fmt.Fprintf(stderr, "Remote session setup failed: %v\r\n", err)
		return
	}

	proxy(maskedReqs, forwardReqs, startHeartbeatingChannel(sessChan, s.Heartbeater, session.InstanceID), forwardChannel)
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
