// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"encoding/json"
	"os"
)

// ServiceConfig configures this service
type ServiceConfig struct {
	Registry       Config `json:"registry"`
	AuthCfg        string `json:"dockerAuth"`
	PProfAddr      string `json:"pprofAddr"`
	PrometheusAddr string `json:"prometheusAddr"`
}

// GetConfig loads and validates the configuration
func GetConfig(fn string) (*ServiceConfig, error) {
	fc, err := os.ReadFile(fn)
	if err != nil {
		return nil, err
	}

	var cfg ServiceConfig
	err = json.Unmarshal(fc, &cfg)
	if err != nil {
		return nil, err
	}

	return &cfg, nil
}

type TLS struct {
	Authority   string `json:"ca"`
	Certificate string `json:"crt"`
	PrivateKey  string `json:"key"`
}

type RSProvider struct {
	Addr string `json:"addr"`
	TLS  *TLS   `json:"tls,omitempty"`
}

// Config configures the registry
type Config struct {
	Port               int              `json:"port"`
	Prefix             string           `json:"prefix"`
	StaticLayer        []StaticLayerCfg `json:"staticLayer"`
	RemoteSpecProvider *RSProvider      `json:"remoteSpecProvider,omitempty"`
	Store              string           `json:"store"`
	RequireAuth        bool             `json:"requireAuth"`
	TLS                *TLS             `json:"tls"`
}

// StaticLayerCfg configure statically added layer
type StaticLayerCfg struct {
	Ref  string `json:"ref"`
	Type string `json:"type"`
}
