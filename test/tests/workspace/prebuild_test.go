// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace_test

import (
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

func TestPrebuildWorkspaceTaskSuccess(t *testing.T) {
	it, _ := integration.NewTest(t, 5*time.Minute)
	defer it.Done()

	ws := integration.LaunchWorkspaceDirectly(it, integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
		req.Type = wsmanapi.WorkspaceType_PREBUILD
		req.Spec.Envvars = append(req.Spec.Envvars, &wsmanapi.EnvironmentVariable{
			Name:  "GITPOD_TASKS",
			Value: `[{ "init": "echo \"some output\" > someFile; sleep 20; exit 0;" }]`,
		})
		return nil
	}))
	it.WaitForWorkspaceStop(ws.Req.Id)
}

func TestPrebuildWorkspaceTaskFail(t *testing.T) {
	it, _ := integration.NewTest(t, 5*time.Minute)
	defer it.Done()

	ws := integration.LaunchWorkspaceDirectly(it, integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
		req.Type = wsmanapi.WorkspaceType_PREBUILD
		req.Spec.Envvars = append(req.Spec.Envvars, &wsmanapi.EnvironmentVariable{
			Name:  "GITPOD_TASKS",
			Value: `[{ "init": "echo \"some output\" > someFile; sleep 20; exit 1;" }]`,
		})
		return nil
	}))
	it.WaitForWorkspace(ws.Req.Id, func(status *wsmanapi.WorkspaceStatus) bool {
		if status.Phase != wsmanapi.WorkspacePhase_STOPPED {
			return false
		}
		if status.Conditions.HeadlessTaskFailed == "" {
			t.Fatal("expected HeadlessTaskFailed condition")
		}
		return true
	})
}
