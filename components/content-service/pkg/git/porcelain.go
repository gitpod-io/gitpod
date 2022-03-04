// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package git

import (
	"bufio"
	"io"
	"strings"

	"golang.org/x/xerrors"
)

const (
	prefixBranchOID     = "# branch.oid "
	prefixBranchHead    = "# branch.head "
	prefixChangedFile   = "1 "
	prefixRenamedFile   = "2 "
	prefixUnmargedFile  = "u "
	prefixUntrackedFile = "? "
)

// porcelainStatus represents the information gathered from Git porcelain v2 output, see https://git-scm.com/docs/git-status#_porcelain_format_version_2
type porcelainStatus struct {
	BranchOID       string
	BranchHead      string
	UncommitedFiles []string
	UntrackedFiles  []string
}

// ParsePorcelain parses the porcelain v2 format
func parsePorcelain(in io.Reader) (*porcelainStatus, error) {
	res := porcelainStatus{
		UncommitedFiles: make([]string, 0),
		UntrackedFiles:  make([]string, 0),
	}

	scanner := bufio.NewScanner(in)
	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, prefixBranchOID) {
			res.BranchOID = strings.TrimPrefix(line, prefixBranchOID)
		} else if strings.HasPrefix(line, prefixBranchHead) {
			res.BranchHead = strings.TrimPrefix(line, prefixBranchHead)
		} else if strings.HasPrefix(line, prefixChangedFile) ||
			strings.HasPrefix(line, prefixRenamedFile) ||
			strings.HasPrefix(line, prefixRenamedFile) ||
			strings.HasPrefix(line, prefixUnmargedFile) {

			segments := strings.Split(line, " ")
			file := segments[len(segments)-1]
			res.UncommitedFiles = append(res.UncommitedFiles, file)
		} else if strings.HasPrefix(line, prefixUntrackedFile) {
			segments := strings.Split(line, " ")
			file := segments[len(segments)-1]
			res.UntrackedFiles = append(res.UntrackedFiles, file)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, xerrors.Errorf("cannot parse porcelain: %v", err)
	}

	if len(res.UncommitedFiles) == 0 {
		res.UncommitedFiles = nil
	}
	if len(res.UntrackedFiles) == 0 {
		res.UntrackedFiles = nil
	}

	return &res, nil
}
