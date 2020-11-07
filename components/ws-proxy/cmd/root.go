// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/proxy"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"

	validation "github.com/go-ozzo/ozzo-validation"
)

var (
	// ServiceName is the name we use for tracing/logging
	ServiceName = "ws-proxy"
	// Version of this service - set during build
	Version = ""
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "ws-proxy",
	Short: "This acts as reverse-proxy for all workspace-bound requests",
	Args:  cobra.MinimumNArgs(1),
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		log.Init(ServiceName, Version, jsonLog, jsonLog)
	},
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	closer := tracing.Init("ws-proxy")
	if closer != nil {
		defer closer.Close()
	}
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().BoolVarP(&jsonLog, "json-log", "v", false, "produce JSON log output on verbose level")
}

// Config configures this servuce
type Config struct {
	Ingress  IngressConfig `json:"ingress"`
	Proxy    proxy.Config  `json:"proxy"`
	SSHProxy struct {
		Enabled bool   `json:"enabled"`
		Addr    string `json:"addr"`
	} `json:"sshProxy"`
	WorkspaceInfoProviderConfig proxy.WorkspaceInfoProviderConfig `json:"workspaceInfoProviderConfig"`
	PProfAddr                   string                            `json:"pprofAddr"`
	PrometheusAddr              string                            `json:"prometheusAddr"`
	ReadinessProbeAddr          string                            `json:"readinessProbeAddr"`
}

// Validate validates the configuration to catch issues during startup and not at runtime
func (c *Config) Validate() error {
	if err := c.Ingress.Validate(); err != nil {
		return err
	}
	if err := c.Proxy.Validate(); err != nil {
		return err
	}
	if err := c.WorkspaceInfoProviderConfig.Validate(); err != nil {
		return err
	}

	return nil
}

// IngressKind names a kind of ingress
type IngressKind string

const (
	// HostBasedIngress uses a Host header to determine where a request should go
	HostBasedIngress IngressKind = "host"
	// PathAndHostIngress uses the path for Theia routing and the Host header for port routing.
	PathAndHostIngress IngressKind = "pathAndHost"
	// PathAndPortIngress uses the path for Theia routing and ports for port routing.
	PathAndPortIngress IngressKind = "pathAndPort"
)

// IngressConfig configures the proxies ingress
type IngressConfig struct {
	Kind               IngressKind                    `json:"kind"`
	HostBasedIngress   *HostBasedInressConfig         `json:"host"`
	PathAndHostIngress *PathAndHostIngressConfig      `json:"pathAndHost"`
	PathAndPortIngress *PathAndPortBasedIngressConfig `json:"pathAndPort"`
}

// Validate validates this config
func (c *IngressConfig) Validate() (err error) {
	switch c.Kind {
	case HostBasedIngress:
		err = c.HostBasedIngress.Validate()
	case PathAndHostIngress:
		err = c.PathAndHostIngress.Validate()
	case PathAndPortIngress:
		err = c.PathAndPortIngress.Validate()
	default:
		return xerrors.Errorf("unknown ingress kind: %s", c.Kind)
	}
	if err != nil {
		return err
	}

	return nil
}

// HostBasedInressConfig configures the host-based ingress
type HostBasedInressConfig struct {
	Address string `json:"address"`
	Header  string `json:"header"`
}

// Validate validates this config
func (c *HostBasedInressConfig) Validate() error {
	if c == nil {
		return xerrors.Errorf("host based ingress config is mandatory")
	}
	return validation.ValidateStruct(c,
		validation.Field(&c.Address, validation.Required),
		validation.Field(&c.Header, validation.Required),
	)
}

// PathAndHostIngressConfig configures path and host based ingress
type PathAndHostIngressConfig struct {
	Address    string `json:"address"`
	Header     string `json:"header"`
	TrimPrefix string `json:"trimPrefix"`
}

// Validate validates the configuration to catch issues during startup and not at runtime
func (c *PathAndHostIngressConfig) Validate() error {
	if c == nil {
		return xerrors.Errorf("pathAndHost based ingress config is mandatory")
	}
	err := validation.ValidateStruct(c,
		validation.Field(&c.Address, validation.Required),
		validation.Field(&c.Header, validation.Required),
	)
	if err != nil {
		return err
	}
	return nil
}

// PathAndPortBasedIngressConfig configures pathAndPort ingress
type PathAndPortBasedIngressConfig struct {
	Address    string `json:"address"`
	TrimPrefix string `json:"trimPrefix"`
	Start      uint16 `json:"start"`
	End        uint16 `json:"end"`
}

// Validate validates the configuration to catch issues during startup and not at runtime
func (c *PathAndPortBasedIngressConfig) Validate() error {
	if c == nil {
		return xerrors.Errorf("pathAndPort based ingress config is mandatory")
	}
	err := validation.ValidateStruct(c,
		validation.Field(&c.Address, validation.Required),
		validation.Field(&c.Start, validation.Required),
		validation.Field(&c.End, validation.Required),
	)
	if err != nil {
		return err
	}

	start, end := c.Start, c.End
	if start > end {
		return xerrors.Errorf("invalid port based ingress range: start (%d) must be <= end (%d)", start, end)
	}
	return err
}

// getConfig loads and validates the configuration
func getConfig(fn string) (*Config, error) {
	fc, err := ioutil.ReadFile(fn)
	if err != nil {
		return nil, err
	}

	var cfg Config
	err = json.Unmarshal(fc, &cfg)
	if err != nil {
		return nil, err
	}

	err = cfg.Validate()
	if err != nil {
		return nil, xerrors.Errorf("config validation error: %w", err)
	}

	return &cfg, nil
}
