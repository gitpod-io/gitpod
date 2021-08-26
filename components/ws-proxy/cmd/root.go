// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/tracing"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/proxy"
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
	Ingress                     proxy.HostBasedIngressConfig      `json:"ingress"`
	Proxy                       proxy.Config                      `json:"proxy"`
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

// getConfig loads and validates the configuration
func getConfig(fn string) (*Config, error) {
	fc, err := os.ReadFile(fn)
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
