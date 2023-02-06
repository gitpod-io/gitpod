// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package controllers

import (
	"testing"
	"time"

	ctesting "github.com/gitpod-io/gitpod/common-go/testing"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/ws-manager-mk2/pkg/activity"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestIsWorkspaceTimedout(t *testing.T) {
	type fixture struct {
		Activity           string                `json:"activity,omitempty"`
		Ws                 workspacev1.Workspace `json:"ws"`
		CreationDelta      string                `json:"creationDelta,omitempty"`
		StoppingSinceDelta string                `json:"stoppingSinceDelta,omitempty"`
	}
	type gold struct {
		Reason string `json:"reason,omitempty"`
		Error  string `json:"error,omitempty"`
	}

	test := ctesting.FixtureTest{
		T:    t,
		Path: "testdata/timeout*.json",
		Test: func(t *testing.T, input interface{}) interface{} {
			fixture := input.(*fixture)
			activity := activity.WorkspaceActivity{}
			ctrl, err := NewTimeoutReconciler(nil, config.Configuration{
				Timeouts: config.WorkspaceTimeoutConfiguration{
					AfterClose:          util.Duration(1 * time.Minute),
					Initialization:      util.Duration(30 * time.Minute),
					TotalStartup:        util.Duration(45 * time.Minute),
					RegularWorkspace:    util.Duration(60 * time.Minute),
					MaxLifetime:         util.Duration(36 * time.Hour),
					HeadlessWorkspace:   util.Duration(90 * time.Minute),
					Stopping:            util.Duration(60 * time.Minute),
					ContentFinalization: util.Duration(55 * time.Minute),
					Interrupted:         util.Duration(5 * time.Minute),
				},
			}, &activity)
			if err != nil {
				t.Errorf("failed to create reconciler: %v", err)
				return nil
			}
			if fixture.Activity != "" {
				dt, err := time.ParseDuration(fixture.Activity)
				if err != nil {
					t.Errorf("cannot parse fixture's Activity: %v", err)
					return nil
				}

				workspaceID := fixture.Ws.Name

				delta := time.Now().Add(-dt)
				activity.Store(workspaceID, delta)
			}

			if fixture.CreationDelta != "" {
				dt, err := time.ParseDuration(fixture.CreationDelta)
				if err != nil {
					t.Errorf("cannot parse fixture's CreationDelta: %v", err)
					return nil
				}

				fixture.Ws.ObjectMeta.CreationTimestamp = metav1.Time{Time: time.Now().Add(-dt)}
			}

			reason, serr := ctrl.isWorkspaceTimedOut(&fixture.Ws)
			result := gold{Reason: reason}
			if serr != nil {
				result.Error = serr.Error()
			}
			return &result
		},
		Fixture: func() interface{} { return &fixture{} },
		Gold:    func() interface{} { return &gold{} },
	}
	test.Run()
}
