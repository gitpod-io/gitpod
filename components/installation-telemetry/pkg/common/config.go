// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	"fmt"
	"os"
)

type Config struct {
	Server string
}

func NewConfig() (*Config, error) {
	config := Config{
		Server: os.Getenv("SERVER_URL"),
	}

	if config.Server == "" {
		return nil, fmt.Errorf("SERVER_URL required")
	}

	return &config, nil
}
