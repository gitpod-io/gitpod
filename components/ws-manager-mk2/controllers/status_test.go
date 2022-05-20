// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controllers

import (
	"context"
	"testing"

	ctesting "github.com/gitpod-io/gitpod/common-go/testing"
	workspacev1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	corev1 "k8s.io/api/core/v1"
)

func TestUpdateWorkspaceStatus(t *testing.T) {
	type fixture struct {
		Pods   corev1.PodList               `json:"pods"`
		Status *workspacev1.WorkspaceStatus `json:"status,omitempty"`
	}
	type gold struct {
		Error  string                       `json:"error,omitempty"`
		Status *workspacev1.WorkspaceStatus `json:"status,omitempty"`
	}

	test := ctesting.FixtureTest{
		T:       t,
		Path:    "testdata/status_*.json",
		Fixture: func() interface{} { return &fixture{} },
		Gold:    func() interface{} { return &gold{} },
		Test: func(t *testing.T, input interface{}) interface{} {
			fixture := input.(*fixture)

			var res workspacev1.Workspace
			if fixture.Status != nil {
				res.Status = *fixture.Status
			}
			err := updateWorkspaceStatus(context.Background(), &res, fixture.Pods)
			if err != nil {
				return &gold{Error: err.Error()}
			}

			return &gold{
				Status: &res.Status,
			}
		},
	}
	test.Run()
}
