// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package config

import (
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/common-go/util"
)

func BenchmarkRenderWorkspacePortURL(b *testing.B) {
	b.ReportAllocs()

	for n := 0; n < b.N; n++ {
		RenderWorkspaceURL("{{.Port}}-{{.Prefix}}.{{.Host}}", "foo", "bar", "gitpod.io")
	}
}

func TestValidate(t *testing.T) {
	fromValidConfig := func(mod func(*Configuration)) *Configuration {
		res := &Configuration{
			Timeouts: WorkspaceTimeoutConfiguration{
				TotalStartup:        util.Duration(10 * time.Second),
				Initialization:      util.Duration(10 * time.Second),
				RegularWorkspace:    util.Duration(10 * time.Second),
				MaxLifetime:         util.Duration(10 * time.Second),
				HeadlessWorkspace:   util.Duration(10 * time.Second),
				AfterClose:          util.Duration(10 * time.Second),
				ContentFinalization: util.Duration(10 * time.Second),
				Stopping:            util.Duration(10 * time.Second),
				Interrupted:         util.Duration(10 * time.Second),
			},
			WorkspaceClasses: map[string]*WorkspaceClass{
				DefaultWorkspaceClass: {},
			},
			HeartbeatInterval:    util.Duration(10 * time.Second),
			GitpodHostURL:        "https://gitpod.io",
			ReconnectionInterval: util.Duration(10 * time.Second),
			WorkspaceURLTemplate: "https://gitpod.io/foobar",
			WorkspaceHostPath:    "/mnt/data",
		}
		mod(res)
		return res
	}

	tests := []struct {
		Name        string
		Expectation string
		Cfg         *Configuration
	}{
		{
			Name: "missing default class",
			Cfg: fromValidConfig(func(c *Configuration) {
				delete(c.WorkspaceClasses, DefaultWorkspaceClass)
			}),
			Expectation: `missing default workspace class ("g1-standard")`,
		},
		{
			Name: "invalid workspace class name",
			Cfg: fromValidConfig(func(c *Configuration) {
				c.WorkspaceClasses["not/a/valid/name"] = &WorkspaceClass{}
			}),
			Expectation: `workspace class name "not/a/valid/name" is invalid: [a valid label must be an empty string or consist of alphanumeric characters, '-', '_' or '.', and must start and end with an alphanumeric character (e.g. 'MyValue',  or 'my_value',  or '12345', regex used for validation is '(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])?')]`,
		},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			err := test.Cfg.Validate()

			var errMsg string
			if err != nil {
				errMsg = err.Error()
			}

			if errMsg != test.Expectation {
				t.Errorf("unexpected validation result: expect \"%s\", got \"%s\"", test.Expectation, errMsg)
			}
		})
	}
}
