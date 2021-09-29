// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"

	ctesting "github.com/gitpod-io/gitpod/common-go/testing"
	"github.com/gitpod-io/gitpod/ws-manager/pkg/clock"
	corev1 "k8s.io/api/core/v1"
)

func TestActOnPodEvent(t *testing.T) {
	type actOnPodEventResult struct {
		Actions []actRecord `json:"actions"`
		Error   string      `json:"error,omitempty"`
	}

	test := ctesting.FixtureTest{
		T:    t,
		Path: "testdata/status_*.json",
		GoldPath: func(fn string) string {
			res := fmt.Sprintf("%s.golden", strings.TrimSuffix(fn, filepath.Ext(fn)))
			res = strings.ReplaceAll(res, "/status_", "/actOnPodEvent_")
			return res
		},
		Test: func(t *testing.T, input interface{}) interface{} {
			fixture := input.(*workspaceObjects)
			manager := Manager{
				clock: clock.LogicalOnly(),
			}
			status, serr := manager.getWorkspaceStatus(*fixture)
			if serr != nil {
				t.Skipf("skipping due to status computation error: %v", serr)
			}

			var rec actRecorder
			err := actOnPodEvent(context.Background(), &rec, status, fixture)

			result := actOnPodEventResult{Actions: rec.Records}
			if err != nil {
				result.Error = err.Error()
			}
			return &result
		},
		Fixture: func() interface{} { return &workspaceObjects{} },
		Gold:    func() interface{} { return &actOnPodEventResult{} },
	}
	test.Run()
}

type actRecord struct {
	Func   string
	Params map[string]interface{}
}

type actRecorder struct {
	Records []actRecord
}

func (r *actRecorder) waitForWorkspaceReady(ctx context.Context, pod *corev1.Pod) (err error) {
	r.Records = append(r.Records, actRecord{
		Func: "waitForWorkspaceReady",
		Params: map[string]interface{}{
			"pod": pod,
		},
	})
	return nil
}

func (r *actRecorder) stopWorkspace(ctx context.Context, workspaceID string, gracePeriod time.Duration) (err error) {
	r.Records = append(r.Records, actRecord{
		Func: "stopWorkspace",
		Params: map[string]interface{}{
			"workspaceID": workspaceID,
			"gracePeriod": gracePeriod,
		},
	})
	return nil
}

func (r *actRecorder) markWorkspace(ctx context.Context, workspaceID string, annotations ...*annotation) error {
	r.Records = append(r.Records, actRecord{
		Func: "markWorkspace",
		Params: map[string]interface{}{
			"workspaceID": workspaceID,
			"annotations": annotations,
		},
	})
	return nil
}

func (r *actRecorder) clearInitializerFromMap(podName string) {
	r.Records = append(r.Records, actRecord{
		Func: "clearInitializerFromMap",
		Params: map[string]interface{}{
			"podName": podName,
		},
	})
}

func (r *actRecorder) initializeWorkspaceContent(ctx context.Context, pod *corev1.Pod) (err error) {
	r.Records = append(r.Records, actRecord{
		Func: "initializeWorkspaceContent",
		Params: map[string]interface{}{
			"pod": pod,
		},
	})
	return nil
}

func (r *actRecorder) finalizeWorkspaceContent(ctx context.Context, wso *workspaceObjects) {
	r.Records = append(r.Records, actRecord{
		Func: "finalizeWorkspaceContent",
		Params: map[string]interface{}{
			"wso": wso,
		},
	})
}

func (r *actRecorder) modifyFinalizer(ctx context.Context, workspaceID string, finalizer string, add bool) error {
	r.Records = append(r.Records, actRecord{
		Func: "modifyFinalizer",
		Params: map[string]interface{}{
			"workspaceID": workspaceID,
			"finalizer":   finalizer,
			"add":         add,
		},
	})
	return nil
}

var _ actingManager = &actRecorder{}
