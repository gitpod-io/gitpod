// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package sshtunnel

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/caddyconfig"
	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/caddyconfig/httpcaddyfile"
	"go.uber.org/zap"
)

func init() {
	caddy.RegisterModule(SSHTunnel{})
	caddyconfig.RegisterAdapter("inject-ssh-tunnel", InjectSSHTunnelAdaper{})
}

func (a InjectSSHTunnelAdaper) Adapt(body []byte, options map[string]interface{}) (result []byte, warnings []caddyconfig.Warning, err error) {
	c := caddyfile.Adapter{ServerType: httpcaddyfile.ServerType{}}
	result, warnings, err = c.Adapt(body, options)
	if err != nil {
		return
	}
	var r map[string]interface{}
	err = json.Unmarshal(result, &r)
	if err != nil {
		return
	}
	if apps, ok := r["apps"].(map[string]interface{}); ok {
		apps["ssh-tunnel"] = make(map[string]interface{})
		result, err = json.Marshal(r)
	}
	return
}

type InjectSSHTunnelAdaper struct {
}

type SSHTunnel struct {
	listener net.Listener
	logger   *zap.Logger
}

func (SSHTunnel) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "ssh-tunnel",
		New: func() caddy.Module { return new(SSHTunnel) },
	}
}

func (s *SSHTunnel) Provision(ctx caddy.Context) error {
	s.logger = ctx.Logger(s)
	return nil
}

func (s *SSHTunnel) Start() error {
	ln, err := caddy.Listen("tcp", "0.0.0.0:22")
	if err != nil {
		return err
	}
	s.listener = ln
	go s.serve()
	s.logger.Info("SSH Tunnel is running")
	return nil
}

func (s SSHTunnel) Stop() error {
	err := s.listener.Close()
	if err != nil {
		return err
	}
	return nil
}

func (s *SSHTunnel) serve() {
	for {
		conn, err := s.listener.Accept()
		if nerr, ok := err.(net.Error); ok && nerr.Temporary() {
			// ignore temporary network error
			continue
		}
		if err != nil {
			return
		}
		go s.handle(conn)
	}
}

func (s *SSHTunnel) handle(conn net.Conn) {
	defer conn.Close()
	addr := fmt.Sprintf("ws-proxy.%s.%s:22", os.Getenv("KUBE_NAMESPACE"), os.Getenv("KUBE_DOMAIN"))
	tconn, err := net.Dial("tcp", addr)
	if err != nil {
		fmt.Printf("dial %s failed with:%v\n", addr, err)
		return
	}
	defer tconn.Close()
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		io.Copy(conn, tconn)
		cancel()
	}()

	go func() {
		io.Copy(tconn, conn)
		cancel()
	}()
	<-ctx.Done()
}

var _ caddy.App = (*SSHTunnel)(nil)
