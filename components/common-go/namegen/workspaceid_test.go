// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package namegen_test

import (
	"testing"

	"github.com/gitpod-io/gitpod/common-go/namegen"
)

func TestGenerateWorkspaceID(t *testing.T) {

	for i := 0; i < 1000; i++ {
		name, err := namegen.GenerateWorkspaceID()
		if err != nil {
			t.Error(err)
		}
		if !namegen.WorkspaceIDPattern.MatchString(name) {
			t.Errorf("The workspace id \"%s\" didn't met the expectation.", name)
		}
	}
}
