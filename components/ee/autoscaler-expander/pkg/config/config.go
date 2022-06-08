// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"bytes"
	"encoding/json"
	"os"

	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/autoscaler-expander/pkg/expander"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
)

func Read(fn string) (*Config, error) {
	ctnt, err := os.ReadFile(fn)
	if err != nil {
		return nil, xerrors.Errorf("cannot read config file: %w", err)
	}

	var cfg Config
	dec := json.NewDecoder(bytes.NewReader(ctnt))
	dec.DisallowUnknownFields()
	err = dec.Decode(&cfg)
	if err != nil {
		return nil, xerrors.Errorf("cannot parse config file: %w", err)
	}

	return &cfg, nil
}

type Config struct {
	Expander expander.Config                `json:"expander"`
	Service  baseserver.ServerConfiguration `json:"service"`
}
