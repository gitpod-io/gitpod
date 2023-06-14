// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"bytes"
	"encoding/json"
	"os"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"golang.org/x/xerrors"
)

type ServiceConfiguration struct {
	Server        *baseserver.Configuration `json:"server,omitempty"`
	IDEConfigPath string                    `json:"ideConfigPath"`
	DockerCfg     string                    `json:"dockerCfg"`
}

func Read(fn string) (*ServiceConfiguration, error) {
	ctnt, err := os.ReadFile(fn)
	if err != nil {
		return nil, xerrors.Errorf("cannot read config file: %w", err)
	}

	var cfg ServiceConfiguration
	dec := json.NewDecoder(bytes.NewReader(ctnt))
	dec.DisallowUnknownFields()
	err = dec.Decode(&cfg)
	if err != nil {
		return nil, xerrors.Errorf("cannot parse config file: %w", err)
	}

	return &cfg, nil
}
