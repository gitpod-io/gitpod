// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package git

import (
	"context"
	"fmt"
	"testing"
)

func TestExampleInitialise(t *testing.T) {
	t.Skipf("just illustrating the use of this package")

	spec := []Op{
		OpAddFile(".gitpod.yml", "foo"),
		OpCommitAll("initial commit"),

		OpCheckoutAfterCreate("some-branch"),
		OpAddFile(".gitpod.yml", "bar"),
		OpCommitAll("some other commit"),
	}

	// The token needs the following scopes: repo, delete_repo
	repo, err := MaterialiseToGitHub(context.Background(), "<your-token-here>", "", TempRepo(true), spec)
	if err != nil {
		t.Fatal(err)
	}

	fmt.Println(repo.CloneURL())

	t.Cleanup(func() {
		err = repo.Delete(context.Background())
		if err != nil {
			t.Error(err)
		}
	})
}
