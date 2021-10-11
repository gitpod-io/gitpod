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
)

type PProf struct {
	Addr string `json:"address"`
}

type Service struct {
	Addr string    `json:"address"`
	TLS  TLSConfig `json:"tls"`
}

type ServiceConfig struct {
	Orchestrator Configuration  `json:"orchestrator"`
	RefCache     RefCacheConfig `json:"refCache,omitempty"`
	Service      Service        `json:"service"`
	Prometheus   Service        `json:"prometheus"`
	PProf        PProf          `json:"pprof"`
}

type RefCacheConfig struct {
	Interval string   `json:"interval"`
	Refs     []string `json:"refs"`
}

type TLSConfig struct {
	Authority   string `json:"ca"`
	Certificate string `json:"crt"`
	PrivateKey  string `json:"key"`
}

// ServerOption produces the GRPC option that configures a server to use this TLS configuration
func (c *TLSConfig) ServerOption() (grpc.ServerOption, error) {
	if c.Authority == "" || c.Certificate == "" || c.PrivateKey == "" {
		return nil, nil
	}

	tlsConfig, err := common_grpc.ClientAuthTLSConfig(
		c.Authority, c.Certificate, c.PrivateKey,
		common_grpc.WithSetClientCAs(true),
		common_grpc.WithClientAuth(tls.RequireAndVerifyClientCert),
		common_grpc.WithServerName("ws-manager"),
	)
	if err != nil {
		return nil, xerrors.Errorf("cannot load certs: %w", err)
	}

	return grpc.Creds(credentials.NewTLS(tlsConfig)), nil
}

// Configuration configures the orchestrator
type Configuration struct {
	WorkspaceManager WorkspaceManagerConfig `json:"wsman"`

	// AuthFile points to a Docker configuration file from which we draw registry authentication
	AuthFile string `json:"authFile"`

	// BaseImageRepository configures repository where we'll push base images to.
	BaseImageRepository string `json:"baseImageRepository"`

	// WorkspaceImageRepository configures the repository where we'll push the final workspace images to.
	// Note that the workspace nodes/kubelets need access to this repository.
	WorkspaceImageRepository string `json:"workspaceImageRepository"`

	// BuilderImage is an image ref to the workspace builder image
	BuilderImage string `json:"builderImage"`

	// BuilderAuthKeyFile points to a keyfile shared by the builder workspaces and this service.
	// The key is used to encypt authentication data shipped across environment varibales.
	BuilderAuthKeyFile string `json:"builderAuthKeyFile,omitempty"`
}

type TLS struct {
	Authority   string `json:"ca"`
	Certificate string `json:"crt"`
	PrivateKey  string `json:"key"`
}

// WorkspaceManagerConfig configures the workspace manager connection
type WorkspaceManagerConfig struct {
	Address string `json:"address"`
	TLS     TLS    `json:"tls,omitempty"`
	// expected to be a wsmanapi.WorkspaceManagerClient - use to avoid dependency on wsmanapi
	// this field is used for testing only
	Client interface{} `json:"-"`
}
