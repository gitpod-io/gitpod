// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package pkg

import (
	"encoding/json"
	"os"

	"github.com/gitpod-io/gitpod/common-go/util"
	validation "github.com/go-ozzo/ozzo-validation"
	"github.com/go-ozzo/ozzo-validation/is"
	"golang.org/x/xerrors"
)

type Config struct {
	LogDebug             bool          `json:"log_debug"`
	CacheDurationRegular util.Duration `json:"cache_duration_regular"`
	CacheDurationBackup  util.Duration `json:"cache_duration_backup"`
	URLUpstream          string        `json:"url_upstream"`
	URLLocal             string        `json:"url_local"`
	MaxIdleConns         int           `json:"max_idle_conns"`
	MaxIdleConnsPerHost  int           `json:"max_idle_conns_per_host"`
	RedisAddr            string        `json:"redis_addr"`
	PrometheusAddr       string        `json:"prometheusAddr"`
}

// Validate validates the configuration to catch issues during startup and not at runtime
func (c *Config) Validate() error {
	if c == nil {
		return xerrors.Errorf("config is missing")
	}

	return validation.ValidateStruct(c,
		validation.Field(&c.CacheDurationRegular, validation.Required),
		validation.Field(&c.CacheDurationBackup, validation.Required),
		validation.Field(&c.URLUpstream, validation.Required, is.URL),
		validation.Field(&c.URLLocal, validation.Required, is.URL),
	)
}

// ReadConfig loads and validates the configuration
func ReadConfig(fn string) (*Config, error) {
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

func (cfg *Config) ToJson() []byte {
	b, err := json.Marshal(cfg)
	if err != nil {
		return nil
	}
	return b
}

func (cfg *Config) RedisEnabled() bool {
	return len(cfg.RedisAddr) > 0
}
