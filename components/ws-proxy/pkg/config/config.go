package config

import (
	"encoding/json"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/proxy"
	"golang.org/x/xerrors"
	"os"
)

// Config configures this service
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

// GetConfig loads and validates the configuration
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
