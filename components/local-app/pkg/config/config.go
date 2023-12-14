// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/gitpod-io/local-app/pkg/telemetry"
	"gopkg.in/yaml.v3"
)

const DEFAULT_LOCATION = "~/.gitpod/config.yaml"

type Config struct {
	Filename string `yaml:"-"`

	ActiveContext string `yaml:"activeContext,omitempty"`
	Contexts      map[string]*ConnectionContext
	Telemetry     Telemetry `yaml:"telemetry"`
	Autoupdate    bool      `yaml:"autoupdate"`
}

type Telemetry struct {
	Enabled  bool   `yaml:"enabled"`
	Identity string `yaml:"identity,omitempty"`
}

func FromBool(v *bool) bool {
	if v == nil {
		return false
	}
	return *v
}

func Bool(v bool) *bool {
	return &v
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

// LoadConfig loads the configuration from a file. If the file does not exist, it returns a default configuration.
// This function never returns nil, even in case of an error. If an error is returned, this function also returns the default configuration.
func LoadConfig(fn string) (res *Config, err error) {
	defer func() {
		if err != nil {
			err = fmt.Errorf("failed to load config from %s: %w", fn, err)
		}
	}()

	if strings.HasPrefix(fn, "~/") {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return nil, err
		}
		fn = filepath.Join(homeDir, fn[2:])
	}

	cfg := &Config{
		Filename: fn,
		Contexts: make(map[string]*ConnectionContext),
		Telemetry: Telemetry{
			Enabled:  !telemetry.DoNotTrack(),
			Identity: telemetry.GenerateIdentity(),
		},
		Autoupdate: true,
	}
	fc, err := os.ReadFile(fn)
	if err != nil {
		return cfg, err
	}
	err = yaml.Unmarshal(fc, &cfg)
	if err != nil {
		return cfg, err
	}

	return cfg, nil
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
