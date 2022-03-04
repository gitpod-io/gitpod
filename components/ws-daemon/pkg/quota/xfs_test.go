// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package quota

import (
	"fmt"
	"sort"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestGetUsedProjectIDs(t *testing.T) {
	type Expectation struct {
		ProjectIDs []int
		Error      string
	}
	tests := []struct {
		Name        string
		Input       string
		InputErr    error
		Expectation Expectation
	}{
		{
			Name:  "no projects",
			Input: "",
		},
		{
			Name:  "single project",
			Input: "#0              4      0      0  00 [------]",
			Expectation: Expectation{
				ProjectIDs: []int{0},
			},
		},
		{
			Name:  "multiple projects none used",
			Input: "#0              0      0      0  00 [------]\n#100            0     5M     5M  00 [------]\n#200            0    10M    10M  00 [------]",
		},
		{
			Name:  "multiple projects in use",
			Input: "#0              0      0      0  00 [------]\n#100            4     5M     5M  00 [------]\n#200            1    10M    10M  00 [------]",
			Expectation: Expectation{
				ProjectIDs: []int{100, 200},
			},
		},
		{
			Name:     "exec failure",
			InputErr: fmt.Errorf("exec failed"),
			Expectation: Expectation{
				Error: "exec failed",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			xfs := &XFS{
				exec: func(dir, command string) (output string, err error) {
					return test.Input, test.InputErr
				},
			}

			var (
				act Expectation
				err error
			)
			act.ProjectIDs, err = xfs.getUsedProjectIDs()
			if err != nil {
				act.Error = err.Error()
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected getUsedProjectIDs (-want +got):\n%s", diff)
			}
		})
	}
}

func TestSetQuota(t *testing.T) {
	type Expectation struct {
		ProjectID  int
		ProjectIDs []int
		Execs      []string
		Error      string
	}
	tests := []struct {
		Name        string
		Size        Size
		ExecErr     func(cmd string) error
		ProjectIDs  []int
		Expectation Expectation
	}{
		{
			Name: "happpy path",
			Size: 100 * Kilobyte,
			Expectation: Expectation{
				ProjectID:  1000,
				ProjectIDs: []int{1000},
				Execs: []string{
					"project -s -d 1 -p /foo 1000",
					"limit -p bsoft=102400 bhard=102400 1000",
				},
			},
		},
		{
			Name:       "with other prj",
			Size:       100 * Kilobyte,
			ProjectIDs: []int{1000},
			Expectation: Expectation{
				ProjectID:  1001,
				ProjectIDs: []int{1000, 1001},
				Execs: []string{
					"project -s -d 1 -p /foo 1001",
					"limit -p bsoft=102400 bhard=102400 1001",
				},
			},
		},
		{
			Name: "prj creation failure",
			Size: 100 * Kilobyte,
			ExecErr: func(cmd string) error {
				if strings.Contains(cmd, "project") {
					return fmt.Errorf("failed to create project")
				}
				return nil
			},
			Expectation: Expectation{
				ProjectID: 0,
				Execs: []string{
					"project -s -d 1 -p /foo 1000",
				},
				Error: "failed to create project",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var (
				act Expectation
				err error
			)
			xfs := &XFS{
				exec: func(dir, command string) (output string, err error) {
					act.Execs = append(act.Execs, command)
					if test.ExecErr != nil {
						return "", test.ExecErr(command)
					}

					return "", nil
				},
				projectIDs: make(map[int]struct{}),
				Dir:        "/",
			}
			for _, prjid := range test.ProjectIDs {
				xfs.projectIDs[prjid] = struct{}{}
			}

			act.ProjectID, err = xfs.SetQuota("/foo", test.Size)
			if err != nil {
				act.Error = err.Error()
			}
			for p := range xfs.projectIDs {
				act.ProjectIDs = append(act.ProjectIDs, p)
			}
			sort.Ints(act.ProjectIDs)

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected SetQuota (-want +got):\n%s", diff)
			}
		})
	}
}
