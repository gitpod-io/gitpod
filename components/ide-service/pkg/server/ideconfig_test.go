// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/gitpod-io/gitpod/ide-service-api/config"

	ctesting "github.com/gitpod-io/gitpod/common-go/testing"
)

func TestParseConfig(t *testing.T) {

	type fixture struct {
		config.IDEConfig
	}
	type gold struct {
		Config config.IDEConfig
		Err    string
	}

	test := ctesting.FixtureTest{
		T:    t,
		Path: "testdata/ideconfig_*.json",
		Test: func(t *testing.T, input interface{}) interface{} {
			fixture := input.(*fixture)

			b, err := json.Marshal(fixture.IDEConfig)
			if err != nil {
				return &gold{Err: err.Error()}
			}

			config, err := ParseConfig(context.Background(), b)
			if err != nil {
				return &gold{Err: err.Error()}
			}
			return &gold{Config: *config, Err: ""}
		},
		Fixture: func() interface{} { return &fixture{} },
		Gold:    func() interface{} { return &gold{} },
	}
	test.Run()
}
