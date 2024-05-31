// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package serverapi

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
)

func generateArray(prefix string, number int, length int, withDot bool) []string {
	var arr []string
	for i := 0; i < number; i++ {
		lengthyPart := strings.Repeat("a", length)
		arr = append(arr, fmt.Sprintf("%s_%d_%s", prefix, i, lengthyPart))
	}
	if withDot {
		arr = append(arr, "...")
	}
	return arr
}

func TestCapGitStatusLength(t *testing.T) {

	tests := []struct {
		name     string
		input    *v1.GitStatus
		expected *v1.GitStatus
	}{
		{
			name: "Short GitStatus",
			input: &v1.GitStatus{
				Branch:               "main",
				LatestCommit:         "abc123",
				TotalUncommitedFiles: 2,
				TotalUnpushedCommits: 3,
				TotalUntrackedFiles:  4,
				UncommitedFiles:      []string{"file1.txt", "file2.txt"},
				UnpushedCommits:      []string{"commit1", "commit2", "commit3"},
				UntrackedFiles:       []string{"file3.txt", "file4.txt", "file5.txt", "file6.txt"},
			},
			expected: &v1.GitStatus{
				Branch:               "main",
				LatestCommit:         "abc123",
				TotalUncommitedFiles: 2,
				TotalUnpushedCommits: 3,
				TotalUntrackedFiles:  4,
				UncommitedFiles:      []string{"file1.txt", "file2.txt"},
				UnpushedCommits:      []string{"commit1", "commit2", "commit3"},
				UntrackedFiles:       []string{"file3.txt", "file4.txt", "file5.txt", "file6.txt"},
			},
		},
		{
			name: "Long GitStatus",
			input: &v1.GitStatus{
				Branch:               "main",
				LatestCommit:         "abc123",
				TotalUncommitedFiles: 2,
				TotalUnpushedCommits: 3,
				TotalUntrackedFiles:  4,
				UncommitedFiles:      []string{"file1.txt", "file2.txt", "file3.txt", "file4.txt", "file5.txt", "file6.txt"},
				UnpushedCommits:      []string{"commit1", "commit2", "commit3", "commit4", "commit5", "commit6", "commit7"},
				UntrackedFiles:       generateArray("file", 800, 10, false),
			},
			expected: &v1.GitStatus{
				Branch:               "main",
				LatestCommit:         "abc123",
				TotalUncommitedFiles: 2,
				TotalUnpushedCommits: 3,
				TotalUntrackedFiles:  4,
				UncommitedFiles:      []string{"file1.txt", "file2.txt", "file3.txt", "file4.txt", "file5.txt", "file6.txt"},
				UnpushedCommits:      []string{"commit1", "commit2", "commit3", "commit4", "commit5", "commit6", "commit7"},
				UntrackedFiles:       generateArray("file", 166, 10, true),
			},
		},
		{
			name: "Long paths in GitStatus",
			input: &v1.GitStatus{
				Branch:               "main",
				LatestCommit:         "abc123",
				TotalUncommitedFiles: 2,
				TotalUnpushedCommits: 3,
				TotalUntrackedFiles:  4,
				UncommitedFiles:      []string{"file1.txt", "file2.txt", "file3.txt", "file4.txt", "file5.txt", "file6.txt"},
				UnpushedCommits:      []string{"commit1", "commit2", "commit3", "commit4", "commit5", "commit6", "commit7"},
				UntrackedFiles:       generateArray("file", 50, 200, false),
			},
			expected: &v1.GitStatus{
				Branch:               "main",
				LatestCommit:         "abc123",
				TotalUncommitedFiles: 2,
				TotalUnpushedCommits: 3,
				TotalUntrackedFiles:  4,
				UncommitedFiles:      []string{"file1.txt", "file2.txt", "file3.txt", "file4.txt", "file5.txt", "file6.txt"},
				UnpushedCommits:      []string{"commit1", "commit2", "commit3", "commit4", "commit5", "commit6", "commit7"},
				UntrackedFiles:       generateArray("file", 17, 200, true),
			},
		},
		{
			name: "Empty GitStatus",
			input: &v1.GitStatus{
				Branch:               "",
				LatestCommit:         "",
				TotalUncommitedFiles: 0,
				TotalUnpushedCommits: 0,
				TotalUntrackedFiles:  0,
				UncommitedFiles:      nil,
				UnpushedCommits:      nil,
				UntrackedFiles:       nil,
			},
			expected: &v1.GitStatus{
				Branch:               "",
				LatestCommit:         "",
				TotalUncommitedFiles: 0,
				TotalUnpushedCommits: 0,
				TotalUntrackedFiles:  0,
				UncommitedFiles:      nil,
				UnpushedCommits:      nil,
				UntrackedFiles:       nil,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := capGitStatusLength(tt.input)
			if diff := cmp.Diff(tt.expected, got, cmpopts.IgnoreUnexported(v1.GitStatus{})); diff != "" {
				t.Errorf("CapGitStatusLength (-want +got):\n%s", diff)
			}

			bytes, err := json.Marshal(tt.input)
			if err != nil {
				t.Error(err)
			}
			if len(bytes) > GIT_STATUS_API_LIMIT_BYTES {
				t.Errorf("JSON size exceeds GIT_STATUS_API_LIMIT_BYTES: %d (%d)", len(bytes), GIT_STATUS_API_LIMIT_BYTES)
			}
		})
	}
}
