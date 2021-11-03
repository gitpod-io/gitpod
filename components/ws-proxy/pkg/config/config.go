// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"encoding/json"
	"os"

	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/ws-proxy/pkg/proxy"
)

// Config configures this service.
type Config struct {
	Ingress            proxy.HostBasedIngressConfig `json:"ingress"`
	Proxy              proxy.Config                 `json:"proxy"`
	PProfAddr          string                       `json:"pprofAddr"`
	PrometheusAddr     string                       `json:"prometheusAddr"`
	ReadinessProbeAddr string                       `json:"readinessProbeAddr"`
	Namespace          string                       `json:"namespace"`
}

// Validate validates the configuration to catch issues during startup and not at runtime.
func (c *Config) Validate() error {
	if err := c.Ingress.Validate(); err != nil {
		return err
	}

	if err := c.Proxy.Validate(); err != nil {
		return err
	}

	return nil
}

// GetConfig loads and validates the configuration.
func GetConfig(fn string) (*Config, error) {
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
