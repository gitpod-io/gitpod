// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"fmt"
	"net/url"

	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"gopkg.in/yaml.v3"
)

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
