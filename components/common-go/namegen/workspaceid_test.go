// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package namegen_test

import (
	"github.com/stretchr/testify/require"
	"testing"

	"github.com/gitpod-io/gitpod/common-go/namegen"
)

func TestGenerateWorkspaceID(t *testing.T) {
	for i := 0; i < 1000; i++ {
		name, err := namegen.GenerateWorkspaceID()
		if err != nil {
			t.Error(err)
		}

		err = namegen.ValidateWorkspaceID(name)
		if err != nil {
			t.Errorf("The workspace id \"%s\" didn't met the expectation.", name)
		}
	}
}

func TestValidateWorkspaceID(t *testing.T) {
	valid := []string{
		"gitpodio-gitpod-65k8jqq6up4",
		"testeraccountw-demoskv1-q2pnb88pvuo",
		"testeraccountwit-empty-g6024jgir2j",
		"a-b-g6024jgir2j",
		"a-bcdefghijklmnopqrstux-g6024jgir2j",
		"abcdefghijklmnopqrstu-x-g6024jgir2j",
		"abcdefghijklmnopqrs24-x-g6024jgir2j",
	}
	for _, v := range valid {
		require.NoError(t, namegen.ValidateWorkspaceID(v))
	}

	invalid := []string{
		"",
		"foo",
		"foo-bar",
		"fo-bo",
		"foo-bar-12",
		"foo--",
		"---",
	}
	for _, i := range invalid {
		require.Error(t, namegen.ValidateWorkspaceID(i))
	}

}
