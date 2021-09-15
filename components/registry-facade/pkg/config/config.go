package config

import (
	"encoding/json"
	"github.com/gitpod-io/gitpod/registry-facade/pkg/registry"
	"os"
)

// Config configures this service
type Config struct {
	Registry       registry.Config `json:"registry"`
	AuthCfg        string          `json:"dockerAuth"`
	PProfAddr      string          `json:"pprofAddr"`
	PrometheusAddr string          `json:"prometheusAddr"`
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

	return &cfg, nil
}
