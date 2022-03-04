// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package sshproxy

import (
	"context"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	p "github.com/gitpod-io/gitpod/ws-proxy/pkg/proxy"
	"golang.org/x/crypto/ssh"
	"golang.org/x/xerrors"
	"google.golang.org/grpc"
)

const GitpodUsername = "gitpod"

type Session struct {
	Conn *ssh.ServerConn

	WorkspaceID string
	InstanceID  string

	PublicKey           ssh.PublicKey
	WorkspacePrivateKey ssh.Signer
}

type Server struct {
	Heartbeater Heartbeat

	sshConfig             *ssh.ServerConfig
	workspaceInfoProvider p.WorkspaceInfoProvider
}

// New creates a new SSH proxy server

func New(signers []ssh.Signer, workspaceInfoProvider p.WorkspaceInfoProvider, heartbeat Heartbeat) *Server {
	server := &Server{
		workspaceInfoProvider: workspaceInfoProvider,
		Heartbeater:           &noHeartbeat{},
	}
	if heartbeat != nil {
		server.Heartbeater = heartbeat
	}

	server.sshConfig = &ssh.ServerConfig{
		ServerVersion: "SSH-2.0-GITPOD-GATEWAY",
		PasswordCallback: func(conn ssh.ConnMetadata, password []byte) (*ssh.Permissions, error) {
			workspaceId, ownerToken := conn.User(), string(password)
			err := server.Authenticator(workspaceId, ownerToken)
			if err != nil {
				return nil, err
			}
			return &ssh.Permissions{
				Extensions: map[string]string{
					"workspaceId": workspaceId,
				},
			}, nil
		},
		PublicKeyCallback: func(conn ssh.ConnMetadata, key ssh.PublicKey) (*ssh.Permissions, error) {
			args := strings.Split(conn.User(), "#")
			// workspaceId#ownerToken
			if len(args) != 2 {
				return nil, fmt.Errorf("username error")
			}
			workspaceId, ownerToken := args[0], args[1]
			err := server.Authenticator(workspaceId, ownerToken)
			if err != nil {
				return nil, err
			}
			return &ssh.Permissions{
				Extensions: map[string]string{
					"workspaceId": workspaceId,
				},
			}, nil
		},
	}
	for _, s := range signers {
		server.sshConfig.AddHostKey(s)
	}
	return server
}

func (s *Server) HandleConn(c net.Conn) {
	sshConn, chans, reqs, err := ssh.NewServerConn(c, s.sshConfig)
	if err != nil {
		c.Close()
		return
	}
	defer sshConn.Close()

	go ssh.DiscardRequests(reqs)
	if sshConn.Permissions == nil || sshConn.Permissions.Extensions == nil || sshConn.Permissions.Extensions["workspaceId"] == "" {
		return
	}
	workspaceId := sshConn.Permissions.Extensions["workspaceId"]
	wsInfo := s.workspaceInfoProvider.WorkspaceInfo(workspaceId)
	if wsInfo == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	key, err := s.GetWorkspaceSSHKey(ctx, wsInfo.IPAddress)
	if err != nil {
		cancel()
		return
	}
	cancel()

	session := &Session{
		Conn:                sshConn,
		WorkspaceID:         workspaceId,
		InstanceID:          wsInfo.InstanceID,
		WorkspacePrivateKey: key,
	}
	remoteAddr := wsInfo.IPAddress + ":23001"
	conn, err := net.Dial("tcp", remoteAddr)
	if err != nil {
		log.WithField("instanceId", wsInfo.InstanceID).WithField("workspaceIP", wsInfo.IPAddress).WithError(err).Error("dail failed")
		return
	}
	defer conn.Close()

	clientConn, clientChans, clientReqs, err := ssh.NewClientConn(conn, remoteAddr, &ssh.ClientConfig{
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		User:            GitpodUsername,
		Auth: []ssh.AuthMethod{
			ssh.PublicKeysCallback(func() (signers []ssh.Signer, err error) {
				return []ssh.Signer{key}, nil
			}),
		},
		Timeout: 10 * time.Second,
	})
	if err != nil {
		log.WithField("instanceId", wsInfo.InstanceID).WithField("workspaceIP", wsInfo.IPAddress).WithError(err).Error("connect failed")
		return
	}
	s.Heartbeater.SendHeartbeat(wsInfo.InstanceID, false)
	client := ssh.NewClient(clientConn, clientChans, clientReqs)
	ctx, cancel = context.WithCancel(context.Background())

	go func() {
		client.Wait()
		cancel()
	}()

	for newChannel := range chans {
		switch newChannel.ChannelType() {
		case "session", "direct-tcpip":
			go s.ChannelForward(ctx, session, client, newChannel)
		case "tcpip-forward":
			newChannel.Reject(ssh.UnknownChannelType, "Gitpod SSH Gateway cannot remote forward ports")
		default:
			newChannel.Reject(ssh.UnknownChannelType, fmt.Sprintf("Gitpod SSH Gateway cannot handle %s channel types", newChannel.ChannelType()))
		}
	}
}

func (s *Server) Authenticator(workspaceId, ownerToken string) (err error) {
	wsInfo := s.workspaceInfoProvider.WorkspaceInfo(workspaceId)
	if wsInfo == nil {
		return fmt.Errorf("not found workspace")
	}
	if wsInfo.Auth.OwnerToken != ownerToken {
		return fmt.Errorf("auth failed")
	}
	return nil
}

func (s *Server) GetWorkspaceSSHKey(ctx context.Context, workspaceIP string) (ssh.Signer, error) {
	supervisorConn, err := grpc.Dial(workspaceIP+":22999", grpc.WithInsecure())
	if err != nil {
		return nil, xerrors.Errorf("failed connecting to supervisor: %w", err)
	}
	defer supervisorConn.Close()
	keyInfo, err := supervisor.NewControlServiceClient(supervisorConn).CreateSSHKeyPair(ctx, &supervisor.CreateSSHKeyPairRequest{})
	if err != nil {
		return nil, xerrors.Errorf("failed getting ssh key pair info from supervisor: %w", err)
	}
	key, err := ssh.ParsePrivateKey([]byte(keyInfo.PrivateKey))
	if err != nil {
		return nil, xerrors.Errorf("failed parse private key: %w", err)
	}
	return key, nil
}

func (s *Server) Serve(l net.Listener) error {
	for {
		conn, err := l.Accept()
		if err != nil {
			return err
		}

		go s.HandleConn(conn)
	}
}
