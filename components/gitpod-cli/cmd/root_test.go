// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestGetCommandName(t *testing.T) {
	tests := []struct {
		Input       string
		Expectation []string
	}{
		{"gp", []string{}},
		{"gp top", []string{"top"}},
		{"gp tasks list", []string{"tasks", "list"}},
		{"gp very nested command", []string{"very", "nested", "command"}},
	}

	for _, test := range tests {
		t.Run(test.Input, func(t *testing.T) {
			cmdName := GetCommandName(test.Input)

			if diff := cmp.Diff(test.Expectation, cmdName); diff != "" {
				t.Errorf("GetCommandName() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
