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

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	ctesting "github.com/gitpod-io/gitpod/common-go/testing"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	config "github.com/gitpod-io/gitpod/ws-manager/api/config"
	"github.com/google/go-cmp/cmp"
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
				Config: config.Configuration{
					Timeouts: config.WorkspaceTimeoutConfiguration{
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

				delta := time.Now().Add(-dt)
				manager.activity.Store(workspaceID, &delta)
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
				_, err := manager.getWorkspaceStatus(wso)
				if err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}

func TestGetNodeName(t *testing.T) {
	tests := []struct {
		Name        string
		WSO         workspaceObjects
		Expectation string
	}{
		{
			Name: "no nodeName",
		},
		{
			Name: "spec",
			WSO: workspaceObjects{
				Pod: &v1.Pod{
					Spec: v1.PodSpec{
						NodeName: "foobar",
					},
				},
			},
			Expectation: "foobar",
		},
		{
			Name: "annotation",
			WSO: workspaceObjects{
				Pod: &v1.Pod{
					ObjectMeta: metav1.ObjectMeta{
						Annotations: map[string]string{
							nodeNameAnnotation: "from-anno",
						},
					},
				},
			},
			Expectation: "from-anno",
		},
		{
			Name: "spec and annotation",
			WSO: workspaceObjects{
				Pod: &v1.Pod{
					ObjectMeta: metav1.ObjectMeta{
						Annotations: map[string]string{
							nodeNameAnnotation: "from-anno",
						},
					},
					Spec: v1.PodSpec{
						NodeName: "from-spec",
					},
				},
			},
			Expectation: "from-spec",
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			act := test.WSO.NodeName()
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected nodeName (-want +got):\n%s", diff)
			}
		})
	}
}
