// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package activity

import (
	"sync"
	"time"

	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
)

// WorkspaceActivity is used to track the last user activity per workspace. This is
// stored in memory instead of on the Workspace resource to limit load on the k8s API,
// as this value will update often for each workspace.
type WorkspaceActivity struct {
	ManagerStartedAt time.Time
	m                sync.Map
}

func NewWorkspaceActivity() *WorkspaceActivity {
	return &WorkspaceActivity{
		ManagerStartedAt: time.Now().UTC(),
	}
}

func (w *WorkspaceActivity) Store(workspaceId string, lastActivity time.Time) {
	w.m.Store(workspaceId, &lastActivity)
}

func (w *WorkspaceActivity) GetLastActivity(ws *workspacev1.Workspace) *time.Time {
	lastActivity, ok := w.m.Load(ws.Name)
	if ok {
		return lastActivity.(*time.Time)
	}

	// In case we don't have a record of the workspace's last activity, check for the FirstUserActivity condition
	// to see if the lastActivity got lost on a manager restart.
	if wsk8s.ConditionPresentAndTrue(ws.Status.Conditions, string(workspacev1.WorkspaceConditionFirstUserActivity)) {
		// Manager was restarted, consider the workspace's last activity to be the time the manager restarted.
		return &w.ManagerStartedAt
	}

	// If the FirstUserActivity condition isn't present we know that the workspace has never had user activity.
	return nil
}
