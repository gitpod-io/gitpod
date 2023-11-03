// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

const DEFAULT_LOCATION = "~/.gitpod/config.yaml"

type Config struct {
	Filename string `yaml:"-"`

	ActiveContext string `yaml:"activeContext,omitempty"`
	Contexts      map[string]*ConnectionContext
}

func (c *Config) GetActiveContext() (*ConnectionContext, error) {
	if c == nil {
		return nil, ErrNoContext
	}
	if c.ActiveContext == "" {
		return nil, ErrNoContext
	}
	res := c.Contexts[c.ActiveContext]
	return res, nil
}

var ErrNoContext = fmt.Errorf("no active context - use \"gitpod login\" to create one")

type ConnectionContext struct {
	Host           url.URL `yaml:"host"`
	OrganizationID string  `yaml:"organizationID,omitempty"`
	Token          string  `yaml:"token,omitempty"`
}

func SaveConfig(fn string, cfg *Config) error {
	fc, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}
	_ = os.MkdirAll(filepath.Dir(fn), 0755)

	err = os.WriteFile(fn, fc, 0644)
	if err != nil {
		return err
	}
	return nil
}

func DefaultConfig() *Config {
	return &Config{
		Filename: DEFAULT_LOCATION,
		Contexts: make(map[string]*ConnectionContext),
	}
}

func LoadConfig(fn string) (res *Config, err error) {
	defer func() {
		if err != nil {
			err = fmt.Errorf("failed to load config from %s: %w", fn, err)
		}
	}()

	var cfg Config
	cfg.Contexts = make(map[string]*ConnectionContext)

	fc, err := os.ReadFile(fn)
	if err != nil {
		return nil, err
	}
	err = yaml.Unmarshal(fc, &cfg)
	if err != nil {
		return nil, err
	}

	cfg.Filename = fn

	return &cfg, nil
}

type configContextKeyTpe struct{}

var configContextKey = configContextKeyTpe{}

func ToContext(ctx context.Context, cfg *Config) context.Context {
	return context.WithValue(ctx, configContextKey, cfg)
}

func FromContext(ctx context.Context) *Config {
	cfg, _ := ctx.Value(configContextKey).(*Config)
	return cfg
}
