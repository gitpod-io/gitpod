// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package quota

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"sync"
)

type xfsQuotaExec func(dir, command string) (output string, err error)

func defaultXfsQuotaExec(dir, command string) (output string, err error) {
	out, err := exec.Command("xfs_quota", "-x", "-c", command, dir).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("xfs_quota error: %s: %v", string(out), err)
	}
	return string(out), nil
}

const (
	prjidLow = 1000
	prjidHi  = 10000
)

type XFS struct {
	Dir string

	exec xfsQuotaExec

	projectIDs map[int]struct{}
	mu         sync.Mutex
}

func NewXFS(path string) (*XFS, error) {
	res := &XFS{
		Dir:        path,
		projectIDs: make(map[int]struct{}),
		exec:       defaultXfsQuotaExec,
	}

	// Note: if the underlying filesystem does not support XFS project quota,
	//       getUsedProjectIDs will fail, hence the NewXFS call will fail.
	prjIDs, err := res.getUsedProjectIDs()
	if err != nil {
		return nil, err
	}
	for _, prjID := range prjIDs {
		res.projectIDs[prjID] = struct{}{}
	}

	return res, nil
}

// getUsedProjectIDs lists all project IDs used on the filesystem
func (xfs *XFS) getUsedProjectIDs() ([]int, error) {
	out, err := xfs.exec(xfs.Dir, "report -N")
	if err != nil {
		return nil, err
	}

	var res []int
	for _, l := range strings.Split(out, "\n") {
		fields := strings.Fields(l)
		if len(fields) < 2 {
			continue
		}

		prjID, err := strconv.Atoi(strings.TrimPrefix(fields[0], "#"))
		if err != nil {
			continue
		}

		used, err := strconv.Atoi(strings.TrimSpace(fields[1]))
		if err != nil || used == 0 {
			continue
		}

		res = append(res, prjID)
	}
	return res, nil
}

// SetQuota sets the quota for a path
func (xfs *XFS) SetQuota(path string, quota Size) (projectID int, err error) {
	xfs.mu.Lock()
	var (
		prjID = prjidLow
		found bool
	)
	for ; prjID < prjidHi; prjID++ {
		_, exists := xfs.projectIDs[prjID]
		if !exists {
			found = true
			xfs.projectIDs[prjID] = struct{}{}
			break
		}
	}
	xfs.mu.Unlock()
	if !found {
		return 0, fmt.Errorf("no free projectID found")
	}

	defer func() {
		if err != nil {
			xfs.mu.Lock()
			delete(xfs.projectIDs, prjID)
			xfs.mu.Unlock()
		}
	}()

	_, err = xfs.exec(xfs.Dir, fmt.Sprintf("project -s -d 1 -p %s %d", path, prjID))
	if err != nil {
		return 0, err
	}
	_, err = xfs.exec(xfs.Dir, fmt.Sprintf("limit -p bsoft=%d bhard=%d %d", quota, quota, prjID))
	if err != nil {
		return 0, err
	}
	return prjID, nil
}

// RegisterProject tells this implementation that a projectID is already in use
func (xfs *XFS) RegisterProject(prjID int) {
	xfs.mu.Lock()
	defer xfs.mu.Unlock()

	xfs.projectIDs[prjID] = struct{}{}
}

// RemoveQuota removes the limitation for a project/path and frees the projectID
func (xfs *XFS) RemoveQuota(projectID int) error {
	_, err := xfs.exec(xfs.Dir, fmt.Sprintf("limit -p bsoft=0 bhard=0 %d", projectID))
	if err != nil {
		return err
	}
	xfs.mu.Lock()
	delete(xfs.projectIDs, projectID)
	xfs.mu.Unlock()
	return nil
}

// GetProjectUseCount returns the number of projectIDs in use
func (xfs *XFS) GetProjectUseCount() int {
	xfs.mu.Lock()
	defer xfs.mu.Unlock()

	return len(xfs.projectIDs)
}
