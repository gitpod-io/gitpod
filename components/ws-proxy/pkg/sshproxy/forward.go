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

	"golang.org/x/crypto/ssh"
)

const GITPOD_USERNAME = "gitpod"

func proxy(reqs1, reqs2 <-chan *ssh.Request, channel1, channel2 ssh.Channel) {
	var closer sync.Once
	closeFunc := func() {
		channel1.Close()
		channel2.Close()
	}

	defer closer.Do(closeFunc)

	closerChan := make(chan bool, 1)

	go func() {
		io.Copy(channel1, channel2)
		closerChan <- true
	}()

	go func() {
		io.Copy(channel2, channel1)
		closerChan <- true
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
		case <-closerChan:
			return
		}
	}
}

func (s *Server) ChannelForward(session *Session, newChannel ssh.NewChannel) {
	clientConfig := &ssh.ClientConfig{
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		User:            GITPOD_USERNAME,
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

	conn, err := net.Dial("tcp", session.WorkspaceIp)
	if err != nil {
		newChannel.Reject(ssh.ConnectionFailed, fmt.Sprintf("Connect failed: %v\r\n", err))
		return
	}
	defer conn.Close()

	clientConn, clientChans, clientReqs, err := ssh.NewClientConn(conn, session.WorkspaceIp, clientConfig)
	if err != nil {
		newChannel.Reject(ssh.ConnectionFailed, fmt.Sprintf("Client connection setup failed: %v\r\n", err))
		return
	}
	client := ssh.NewClient(clientConn, clientChans, clientReqs)

	channel2, _, err := client.OpenChannel("direct-tcpip", newChannel.ExtraData())
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
		channel2.Close()
		client.Close()
	}

	go func() {
		io.Copy(channel, channel2)
		closer.Do(closeFunc)
	}()

	io.Copy(channel2, channel)
	closer.Do(closeFunc)
}

func (s *Server) SessionForward(session *Session, newChannel ssh.NewChannel) {
	sesschan, sessReqs, err := newChannel.Accept()
	if err != nil {
		return
	}
	defer sesschan.Close()

	maskedReqs := make(chan *ssh.Request, 1)
	go func() {
		for req := range sessReqs {
			switch req.Type {
			case "pty-req", "shell":
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

	stderr := sesschan.Stderr()

	clientConfig := &ssh.ClientConfig{
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		User:            GITPOD_USERNAME,
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

	conn, err := net.Dial("tcp", session.WorkspaceIp)
	if err != nil {
		fmt.Fprintf(stderr, "Connect failed: %v\r\n", err)
		return
	}
	defer conn.Close()

	clientConn, clientChans, clientReqs, err := ssh.NewClientConn(conn, session.WorkspaceIp, clientConfig)
	if err != nil {
		fmt.Fprintf(stderr, "Client connection setup failed: %v\r\n", err)
		return
	}
	client := ssh.NewClient(clientConn, clientChans, clientReqs)

	channel2, reqs2, err := client.OpenChannel("session", []byte{})
	if err != nil {
		fmt.Fprintf(stderr, "Remote session setup failed: %v\r\n", err)
		return
	}

	proxy(maskedReqs, reqs2, sesschan, channel2)
}
