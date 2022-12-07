// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package util

import (
	"os/exec"

	"github.com/cockroachdb/errors"
)

var (
	ErrBranchNotExist = errors.New("branch doesn't exist")
)

func BranchFromGit(branch string) (string, error) {
	if branch == "" {
		out, err := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD").Output()
		if err != nil {
			return "", errors.Wrap(err, "Could not retrieve branch name.")
		}

		branch = string(out)
	} else {
		_, err := exec.Command("git", "rev-parse", "--verify", branch).Output()
		if err != nil {
			return "", errors.CombineErrors(err, ErrBranchNotExist)
		}
	}

	return branch, nil
}
