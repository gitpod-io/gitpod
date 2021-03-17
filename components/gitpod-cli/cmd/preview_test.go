// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"os"
	"testing"

	"github.com/golang/mock/gomock"
)

func TestReplaceLocalhostInURL(t *testing.T) {
	tests := []struct {
		Desc         string
		Input        string
		ExpectedPort uint16
		PortURL      string
		Expectation  string
	}{
		{"just localhost", "localhost", 80, "80-workspace-url", "80-workspace-url"},
		{"just localhost w port", "localhost:1234", 1234, "1234-workspace-url", "1234-workspace-url"},
		{"just localhost w http", "http://localhost", 80, "https://80-workspace-url", "https://80-workspace-url"},
		{"just localhost w https", "https://localhost", 80, "https://80-workspace-url", "https://80-workspace-url"},
		{"just localhost w port/http", "http://localhost:1234", 1234, "https://1234-workspace-url", "https://1234-workspace-url"},
		{"just localhost w port/https", "https://localhost:1234", 1234, "https://1234-workspace-url", "https://1234-workspace-url"},
		{"localhost param", "https://something.org?cb=localhost", 0, "", "https://something.org?cb=localhost"},
		{"localhost param w port", "https://something.org?cb=localhost:8080", 0, "", "https://something.org?cb=localhost:8080"},
		{"localhost param w http", "https://something.org?cb=http://localhost", 80, "https://80-workspace-url", "https://something.org?cb=https://80-workspace-url"},
		{"localhost param w http/path", "https://something.org?cb=http://localhost/foo", 80, "https://80-workspace-url", "https://something.org?cb=https://80-workspace-url/foo"},
		{"localhost param w https", "https://something.org?cb=https://localhost", 80, "https://80-workspace-url", "https://something.org?cb=https://80-workspace-url"},
		{"localhost param w port/http", "https://something.org?cb=http://localhost:8080", 8080, "https://8080-workspace-url", "https://something.org?cb=https://8080-workspace-url"},
		{"localhost param w port/https", "https://something.org?cb=https://localhost:8080", 8080, "https://8080-workspace-url", "https://something.org?cb=https://8080-workspace-url"},
		{"just 127.0.0.1", "127.0.0.1", 80, "80-workspace-url", "80-workspace-url"},
		{"just 127.0.0.1 w port", "127.0.0.1:1234", 1234, "1234-workspace-url", "1234-workspace-url"},
		{"just 127.0.0.1 w http", "http://127.0.0.1", 80, "https://80-workspace-url", "https://80-workspace-url"},
		{"just 127.0.0.1 w https", "https://127.0.0.1", 80, "https://80-workspace-url", "https://80-workspace-url"},
		{"just 127.0.0.1 w port/http", "http://127.0.0.1:1234", 1234, "https://1234-workspace-url", "https://1234-workspace-url"},
		{"just 127.0.0.1 w port/https", "https://127.0.0.1:1234", 1234, "https://1234-workspace-url", "https://1234-workspace-url"},
		{"127.0.0.1 param", "https://something.org?cb=127.0.0.1", 0, "", "https://something.org?cb=127.0.0.1"},
		{"127.0.0.1 param w port", "https://something.org?cb=127.0.0.1:8080", 0, "", "https://something.org?cb=127.0.0.1:8080"},
		{"127.0.0.1 param w http", "https://something.org?cb=http://127.0.0.1", 80, "https://80-workspace-url", "https://something.org?cb=https://80-workspace-url"},
		{"127.0.0.1 param w http/path", "https://something.org?cb=http://127.0.0.1/foo", 80, "https://80-workspace-url", "https://something.org?cb=https://80-workspace-url/foo"},
		{"127.0.0.1 param w https", "https://something.org?cb=https://127.0.0.1", 80, "https://80-workspace-url", "https://something.org?cb=https://80-workspace-url"},
		{"127.0.0.1 param w port/http", "https://something.org?cb=http://127.0.0.1:8080", 8080, "https://8080-workspace-url", "https://something.org?cb=https://8080-workspace-url"},
		{"127.0.0.1 param w port/https", "https://something.org?cb=https://127.0.0.1:8080", 8080, "https://8080-workspace-url", "https://something.org?cb=https://8080-workspace-url"},
	}

	os.Setenv("GITPOD_WORKSPACE_URL", "https://workspace-url")
	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			act := replaceLocalhostInURL(test.Input)
			if act != test.Expectation {
				t.Errorf("unexpected result: %s, expected %s", act, test.Expectation)
			}
		})
	}
}
