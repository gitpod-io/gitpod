// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package activity

import (
	"sync"
	"time"
)

// WorkspaceActivity is used to track the last user activity per workspace. This is
// stored in memory instead of on the Workspace resource to limit load on the k8s API,
// as this value will update often for each workspace.
type WorkspaceActivity struct {
	m sync.Map
}

func (w *WorkspaceActivity) Store(workspaceId string, lastActivity time.Time) {
	w.m.Store(workspaceId, &lastActivity)
}

func (w *WorkspaceActivity) GetLastActivity(workspaceId string) *time.Time {
	lastActivity, ok := w.m.Load(workspaceId)
	if ok {
		return lastActivity.(*time.Time)
	}
	return nil
}
