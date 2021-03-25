// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package manager

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	ctesting "github.com/gitpod-io/gitpod/common-go/testing"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

func TestIsWorkspaceTimedout(t *testing.T) {
	type fixture struct {
		Activity           string           `json:"activity,omitempty"`
		WSO                workspaceObjects `json:"wso"`
		CreationDelta      string           `json:"creationDelta,omitempty"`
		StoppingSinceDelta string           `json:"stoppingSinceDelta,omitempty"`
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
			manager := Manager{
				activity: make(map[string]time.Time),
				Config: Configuration{
					Timeouts: WorkspaceTimeoutConfiguration{
						AfterClose:          util.Duration(1 * time.Minute),
						Initialization:      util.Duration(30 * time.Minute),
						TotalStartup:        util.Duration(45 * time.Minute),
						RegularWorkspace:    util.Duration(60 * time.Minute),
						HeadlessWorkspace:   util.Duration(90 * time.Minute),
						Stopping:            util.Duration(60 * time.Minute),
						ContentFinalization: util.Duration(55 * time.Minute),
						Interrupted:         util.Duration(5 * time.Minute),
					},
				},
			}
			if fixture.Activity != "" {
				dt, err := time.ParseDuration(fixture.Activity)
				if err != nil {
					t.Errorf("cannot parse fixture's Activity: %v", err)
					return nil
				}

				workspaceID, ok := fixture.WSO.WorkspaceID()
				if !ok {
					t.Errorf("fixture pod has no %s annotation", workspaceIDAnnotation)
					return nil
				}

				manager.activity[workspaceID] = time.Now().Add(-dt)
			}

			if fixture.CreationDelta != "" && fixture.WSO.Pod != nil {
				dt, err := time.ParseDuration(fixture.CreationDelta)
				if err != nil {
					t.Errorf("cannot parse fixture's CreationDelta: %v", err)
					return nil
				}

				fixture.WSO.Pod.ObjectMeta.CreationTimestamp = metav1.Time{Time: time.Now().Add(-dt)}
			}

			reason, serr := manager.isWorkspaceTimedOut(fixture.WSO)
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

func TestGetWorkspaceStatusWithFixtures(t *testing.T) {
	type statusTestResult struct {
		Status *api.WorkspaceStatus `json:"status"`
		Error  string               `json:"error,omitempty"`
	}

	test := ctesting.FixtureTest{
		T:    t,
		Path: "testdata/status_*.json",
		Test: func(t *testing.T, input interface{}) interface{} {
			fixture := input.(*workspaceObjects)
			manager := Manager{}

			status, serr := manager.getWorkspaceStatus(*fixture)
			result := statusTestResult{Status: status}
			if serr != nil {
				result.Error = serr.Error()
			}
			return &result
		},
		Fixture: func() interface{} { return &workspaceObjects{} },
		Gold:    func() interface{} { return &statusTestResult{} },
	}
	test.Run()
}

func BenchmarkGetStatus(b *testing.B) {
	fs, err := filepath.Glob("testdata/status_*.json")
	if err != nil {
		b.Fatal(err)
	}
	for _, f := range fs {
		if strings.Contains(f, "degenerate") {
			continue
		}

		b.Run(f, func(b *testing.B) {
			b.ReportAllocs()

			buf, err := os.ReadFile(f)
			if err != nil {
				b.Fatal(err)
			}
			var wso workspaceObjects
			err = json.Unmarshal(buf, &wso)
			if err != nil {
				b.Fatal(err)
			}

			manager := Manager{}

			b.ResetTimer()
			for n := 0; n < b.N; n++ {
				r, err := manager.getWorkspaceStatus(wso)
				if err != nil {
					b.Fatal(err)
					r.Auth = nil
				}
			}
		})
	}

}
