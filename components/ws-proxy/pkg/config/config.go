// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"context"
	"encoding/json"
	"os"
	"time"

	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/experiments"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/proxy"
)

const experimentsCorsEnabled = "ws_proxy_cors_enabled"

// Config configures this service.
type Config struct {
	Ingress            proxy.HostBasedIngressConfig `json:"ingress"`
	Proxy              proxy.Config                 `json:"proxy"`
	PProfAddr          string                       `json:"pprofAddr"`
	PrometheusAddr     string                       `json:"prometheusAddr"`
	ReadinessProbeAddr string                       `json:"readinessProbeAddr"`
	Namespace          string                       `json:"namespace"`
	WorkspaceManager   *WorkspaceManagerConn        `json:"wsManager"`
}

type WorkspaceManagerConn struct {
	Addr string `json:"addr"`
	TLS  struct {
		CA   string `json:"ca"`
		Cert string `json:"crt"`
		Key  string `json:"key"`
	} `json:"tls"`
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

	timeout := time.Second * 45
	log.WithField("timeout", timeout).Info("waiting for Feature Flag")
	experimentsClient := experiments.NewClient(experiments.WithPollInterval(time.Second * 3))
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	ffValue := waitExperimentsStringValue(ctx, experimentsClient, experimentsCorsEnabled, "nope", experiments.Attributes{})
	corsEnabled := ffValue == "true"
	cfg.Proxy.CorsEnabled = corsEnabled
	log.WithField("ffValue", ffValue).WithField("corsEnabled", cfg.Proxy.CorsEnabled).Info("feature flag final value")

	return &cfg, nil
}

func waitExperimentsStringValue(ctx context.Context, client experiments.Client, experimentName, nopeValue string, attributes experiments.Attributes) string {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nopeValue
		case <-ticker.C:
			value := client.GetStringValue(ctx, experimentName, nopeValue, attributes)
			if value != nopeValue {
				return value
			}
		}
	}
}
