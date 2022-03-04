// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"crypto/tls"

	"golang.org/x/xerrors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"

	common_grpc "github.com/gitpod-io/gitpod/common-go/grpc"
	"github.com/gitpod-io/gitpod/ws-daemon/pkg/daemon"
)

type Config struct {
	Daemon     daemon.Config `json:"daemon"`
	Service    AddrTLS       `json:"service"`
	Prometheus Addr          `json:"prometheus"`
	PProf      Addr          `json:"pprof"`
}

type Addr struct {
	Addr string `json:"address"`
}

type AddrTLS struct {
	Addr string `json:"address"`
	TLS  *TLS   `json:"tls,omitempty"`
}
type TLS struct {
	Authority   string `json:"ca"`
	Certificate string `json:"crt"`
	PrivateKey  string `json:"key"`
}

// ServerOption produces the GRPC option that configures a server to use this TLS configuration
func (c *TLS) ServerOption() (grpc.ServerOption, error) {
	if c.Authority == "" || c.Certificate == "" || c.PrivateKey == "" {
		return nil, nil
	}

	tlsConfig, err := common_grpc.ClientAuthTLSConfig(
		c.Authority, c.Certificate, c.PrivateKey,
		common_grpc.WithClientAuth(tls.RequireAndVerifyClientCert),
		common_grpc.WithSetClientCAs(true),
		common_grpc.WithServerName("ws-manager"),
	)
	if err != nil {
		return nil, xerrors.Errorf("cannot load certs: %w", err)
	}

	return grpc.Creds(credentials.NewTLS(tlsConfig)), nil
}
