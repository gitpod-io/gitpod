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
	"strings"

	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/gitpod-io/local-app/pkg/telemetry"
	"gopkg.in/yaml.v3"
)

const DEFAULT_LOCATION = "~/.gitpod/config.yaml"

type Config struct {
	Filename string `yaml:"-"`

	ActiveContext string `yaml:"activeContext,omitempty"`
	Contexts      map[string]*ConnectionContext
	Telemetry     *Telemetry `yaml:"telemetry,omitempty"`
}

type Telemetry struct {
	Enabled  bool   `yaml:"enabled,omitempty"`
	Identity string `yaml:"identity,omitempty"`
}

func (c *Config) GetActiveContext() (*ConnectionContext, error) {
	if c == nil {
		return nil, ErrNoContext
	}
	if c.ActiveContext == "" {
		return nil, ErrNoContext
	}
	res := c.Contexts[c.ActiveContext]
	if res == nil {
		return nil, ErrNoContext
	}
	return res, nil
}

var ErrNoContext = prettyprint.AddResolution(fmt.Errorf("no active context"),
	"sign in using `{gitpod} login`",
	"select an existing context using `{gitpod} config use-context`",
	"create a new context using `{gitpod} config add-context`",
)

type ConnectionContext struct {
	Host           *YamlURL `yaml:"host"`
	OrganizationID string   `yaml:"organizationID,omitempty"`
	Token          string   `yaml:"token,omitempty"`
}

type YamlURL struct {
	*url.URL
}

// UnmarshalYAML implements yaml.Unmarshaler
func (u *YamlURL) UnmarshalYAML(value *yaml.Node) error {
	var s string
	err := value.Decode(&s)
	if err != nil {
		return err
	}

	res, err := url.Parse(s)
	if err != nil {
		return err
	}

	*u = YamlURL{URL: res}
	return nil
}

// MarshalYAML implements yaml.Marshaler
func (u *YamlURL) MarshalYAML() (interface{}, error) {
	return u.String(), nil
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
		Telemetry: &Telemetry{
			Enabled:  !telemetry.DoNotTrack(),
			Identity: telemetry.RandomIdentity(),
		},
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
