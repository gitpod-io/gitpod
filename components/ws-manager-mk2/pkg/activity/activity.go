// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package activity

import (
	"context"
	"time"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/util/retry"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/gitpod-io/gitpod/common-go/log"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
)

// WorkspaceActivity is used to track the last user activity per workspace. This is
// stored in memory instead of on the Workspace resource to limit load on the k8s API,
// as this value will update often for each workspace.
type WorkspaceActivity struct {
	client    client.Client
	namespace string

	ManagerStartedAt time.Time
}

func NewWorkspaceActivity(namespace string, client client.Client) *WorkspaceActivity {
	return &WorkspaceActivity{
		ManagerStartedAt: time.Now().UTC(),
		client:           client,
		namespace:        namespace,
	}
}

var (
	// retryParams are custom backoff parameters used to modify a workspace.
	// These params retry more quickly than the default retry.DefaultBackoff.
	retryParams = wait.Backoff{
		Steps:    10,
		Duration: 10 * time.Millisecond,
		Factor:   2.0,
		Jitter:   0.2,
	}
)

func (w *WorkspaceActivity) Store(workspaceId string, lastActivity time.Time) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var ws workspacev1.Workspace
	err := w.client.Get(ctx, types.NamespacedName{Namespace: w.namespace, Name: workspaceId}, &ws)
	if err != nil {
		log.Error(err, "cannot store workspace last activity")
		return
	}

	lastActivityStatus := metav1.NewTime(lastActivity)
	ws.Status.LastActivity = &lastActivityStatus

	err = retry.RetryOnConflict(retryParams, func() error {
		var ws workspacev1.Workspace
		err := w.client.Get(ctx, types.NamespacedName{Namespace: w.namespace, Name: workspaceId}, &ws)
		if err != nil {
			return err
		}

		return w.client.Status().Update(ctx, &ws)
	})
	if err != nil {
		log.Error(err, "cannot update workspace status")
	}
}

func (w *WorkspaceActivity) GetLastActivity(ws *workspacev1.Workspace) *time.Time {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var workspace workspacev1.Workspace
	err := w.client.Get(ctx, types.NamespacedName{
		Namespace: ws.Namespace,
		Name:      ws.Name,
	}, &workspace)
	if err != nil {
		if !errors.IsNotFound(err) {
			log.Error(err, "unable to fetch workspace")
		}

		return nil
	}

	if workspace.Status.LastActivity != nil {
		return &workspace.Status.LastActivity.Time
	}

	// In case we don't have a record of the workspace's last activity, check for the FirstUserActivity condition
	// to see if the lastActivity got lost on a manager restart.
	if workspace.IsConditionTrue(workspacev1.WorkspaceConditionFirstUserActivity) {
		// Manager was restarted, consider the workspace's last activity to be the time the manager restarted.
		return &w.ManagerStartedAt
	}

	// If the FirstUserActivity condition isn't present we know that the workspace has never had user activity.
	return nil
}
