// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ssh

import (
	"context"
	"fmt"
	"io"
	"net"

	"golang.org/x/crypto/ssh"
)

type Client interface {
	io.Closer

	Run(ctx context.Context, cmd string, stdout io.Writer, stderr io.Writer) error
}

type ClientFactory interface {
	Dial(ctx context.Context, host, port string) (Client, error)
}

type ClientImplementation struct {
	Client *ssh.Client
}

var _ Client = &ClientImplementation{}

func (s *ClientImplementation) Run(ctx context.Context, cmd string, stdout io.Writer, stderr io.Writer) error {
	sess, err := s.Client.NewSession()
	if err != nil {
		return err
	}

	defer func(sess *ssh.Session) {
		err := sess.Close()
		if err != nil && err != io.EOF {
			panic(err)
		}
	}(sess)

	sess.Stdout = stdout
	sess.Stderr = stderr

	return sess.Run(cmd)
}

func (s *ClientImplementation) Close() error {
	return s.Client.Close()
}

type FactoryImplementation struct {
	SSHConfig *ssh.ClientConfig
}

var _ ClientFactory = &FactoryImplementation{}

func (f *FactoryImplementation) Dial(ctx context.Context, host, port string) (Client, error) {
	addr := fmt.Sprintf("%s:%s", host, port)
	d := net.Dialer{}
	conn, err := d.DialContext(ctx, "tcp", addr)
	if err != nil {
		return nil, err
	}

	var client *ssh.Client
	c, chans, reqs, err := ssh.NewClientConn(conn, addr, f.SSHConfig)
	if err != nil {
		return nil, err
	}

	client = ssh.NewClient(c, chans, reqs)

	return &ClientImplementation{
		Client: client,
	}, nil
}
