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

func TestGhostWorkspace(t *testing.T) {
	it, _ := integration.NewTest(t, 5*time.Minute)
	defer it.Done()

	// there's nothing specific about ghost that we want to test beyond that they start properly
	ws := it.LaunchWorkspaceDirectly(integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
		req.Type = wsmanapi.WorkspaceType_GHOST
		req.Spec.Envvars = append(req.Spec.Envvars, &wsmanapi.EnvironmentVariable{
			Name:  "GITPOD_TASKS",
			Value: `[{ "init": "echo \"some output\" > someFile; sleep 20; exit 0;" }]`,
		})
		return nil
	}))
	defer it.DeleteWorkspace(ws.Req.Id)
}
