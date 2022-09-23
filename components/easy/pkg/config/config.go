// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package config

import (
	"github.com/gitpod-io/gitpod/common-go/baseserver"
)

type Config struct {
	Server *baseserver.Configuration `json:"server,omitempty"`

	Usage Usage
}

func FromYAML(filepath string) (Config, error) {
	// parse config from a file...

	return Config{
		Server: &baseserver.Configuration{
			Services: baseserver.ServicesConfiguration{
				GRPC: &baseserver.ServerConfiguration{
					Address: ":9000",
					TLS:     nil,
				},
				HTTP: &baseserver.ServerConfiguration{
					Address: ":9001",
					TLS:     nil,
				},
			},
		},
		Usage: Usage{},
	}, nil
}

type Usage struct {
	FooBar string `json:"foo_bar"`
}
