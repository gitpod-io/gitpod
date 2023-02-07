// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package preview

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"github.com/cockroachdb/errors"
	"github.com/gitpod-io/gitpod/previewctl/pkg/util"
)

func GetName(branch string) (string, error) {
	var err error

	if v := os.Getenv("GITHUB_ACTIONS"); v != "" && branch == "" {
		branch = os.Getenv("GITHUB_HEAD_REF")
	}

	if branch == "" {
		branch, err = util.BranchFromGit(branch)
		if err != nil {
			return "", err
		}
	}

	branch = strings.TrimSpace(branch)
	withoutRefsHead := strings.Replace(branch, "/refs/heads/", "", 1)
	lowerCased := strings.ToLower(withoutRefsHead)

	var re = regexp.MustCompile(`[^-a-z0-9]`)
	sanitizedBranch := re.ReplaceAllString(lowerCased, `$1-$2`)

	if len(sanitizedBranch) > 20 {
		h := sha256.New()
		h.Write([]byte(sanitizedBranch))
		hashedBranch := hex.EncodeToString(h.Sum(nil))

		sanitizedBranch = sanitizedBranch[0:10] + hashedBranch[0:10]
	}

	return sanitizedBranch, nil
}

type BranchMap struct {
	PreviewName    string
	BranchName     string
	LastCommitDate time.Time
}

// GetRecentBranches Returns branches that have commits after the supplied date
func GetRecentBranches(dt time.Time) (map[string]BranchMap, error) {
	branches := exec.Command("git", "for-each-ref", "--sort=committerdate", "refs/remotes/origin", "--format='%(refname:lstrip=3),%(committerdate)'")

	stdout := new(bytes.Buffer)
	stderr := new(bytes.Buffer)

	branches.Stdout = stdout
	branches.Stderr = stderr

	err := branches.Run()
	if err != nil {
		return nil, errors.Wrap(err, stderr.String())
	}

	clean := strings.ReplaceAll(stdout.String(), "'", "")
	lines := strings.Split(strings.TrimSpace(clean), "\n")
	bMap := make(map[string]BranchMap)
	for _, l := range lines {
		split := strings.Split(l, ",")
		if len(split) != 2 {
			return nil, errors.Newf("unexpected length: [%v]: [%v]", len(split), split)
		}

		date, err := time.Parse(time.ANSIC+" -0700", split[1])
		if err != nil {
			return nil, err
		}

		if date.After(dt) {
			branchName := split[0]
			previewName, err := GetName(split[0])
			if err != nil {
				return nil, err
			}

			bMap[previewName] = BranchMap{
				PreviewName:    previewName,
				BranchName:     branchName,
				LastCommitDate: date,
			}
		}
	}

	return bMap, err
}
