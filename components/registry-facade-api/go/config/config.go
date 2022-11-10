// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"encoding/json"
	"os"

	"golang.org/x/xerrors"
)

// ServiceConfig configures this service
type ServiceConfig struct {
	Registry           Config `json:"registry"`
	AuthCfg            string `json:"dockerAuth"`
	PProfAddr          string `json:"pprofAddr"`
	PrometheusAddr     string `json:"prometheusAddr"`
	ReadinessProbeAddr string `json:"readinessProbeAddr"`
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

	if cfg.Registry.IPFSCache != nil && cfg.Registry.IPFSCache.Enabled {
		if cfg.Registry.RedisCache == nil || !cfg.Registry.RedisCache.Enabled {
			return nil, xerrors.Errorf("IPFS cache requires Redis")
		}
	}

	if cfg.Registry.RedisCache != nil {
		rd := cfg.Registry.RedisCache
		rd.Password = os.Getenv("REDIS_PASSWORD")
		cfg.Registry.RedisCache = rd
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
	FixedSpecProvider  string           `json:"fixedSpecFN,omitempty"`
	Store              string           `json:"store"`
	RequireAuth        bool             `json:"requireAuth"`
	TLS                *TLS             `json:"tls"`

	IPFSCache *IPFSCacheConfig `json:"ipfs,omitempty"`

	RedisCache *RedisCacheConfig `json:"redis,omitempty"`
}

type RedisCacheConfig struct {
	Enabled bool `json:"enabled"`

	SingleHostAddress string `json:"singleHostAddr,omitempty"`

	Username string `json:"username,omitempty"`
	Password string `json:"-" env:"REDIS_PASSWORD"`

	UseTLS             bool `json:"useTLS,omitempty"`
	InsecureSkipVerify bool `json:"insecureSkipVerify,omitempty"`
}

type IPFSCacheConfig struct {
	Enabled  bool   `json:"enabled"`
	IPFSAddr string `json:"ipfsAddr"`
}

// StaticLayerCfg configure statically added layer
type StaticLayerCfg struct {
	Ref  string `json:"ref"`
	Type string `json:"type"`
}
