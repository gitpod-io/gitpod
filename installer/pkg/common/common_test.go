// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common_test

import (
	"testing"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/google/go-cmp/cmp"
)

func TestRepoName(t *testing.T) {
	type Expectation struct {
		Result string
		Panics bool
	}
	tests := []struct {
		Repo        string
		Name        string
		Expectation Expectation
	}{
		{
			Name: "gitpod-io/workspace-full",
			Expectation: Expectation{
				Result: "docker.io/gitpod-io/workspace-full",
			},
		},
		{
			Repo: "some-repo.com",
			Name: "some-image",
			Expectation: Expectation{
				Result: "some-repo.com/some-image",
			},
		},
		{
			Repo: "some-repo",
			Name: "not@avalid#image-name",
			Expectation: Expectation{
				Panics: true,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Repo+"/"+test.Name, func(t *testing.T) {
			var act Expectation
			func() {
				defer func() {
					if recover() != nil {
						act.Panics = true
					}
				}()
				act.Result = common.RepoName(test.Repo, test.Name)
			}()

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("RepoName() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
