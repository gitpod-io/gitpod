// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace_test

import (
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
	agent "github.com/gitpod-io/gitpod/test/tests/workspace/workspace_agent/api"
)

func TestRunDocker(t *testing.T) {
	it, _ := integration.NewTest(t, 5*time.Minute)
	defer it.Done()

	ws := integration.LaunchWorkspaceDirectly(it)
	instanceID := ws.Req.Id
	defer integration.DeleteWorkspace(it, ws.Req.Id)

	rsa, err := it.Instrument(integration.ComponentWorkspace, "workspace", integration.WithInstanceID(instanceID), integration.WithWorkspacekitLift(true))
	if err != nil {
		t.Error(err)
		return
	}
	defer rsa.Close()

	var resp agent.ExecResponse
	err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     "/",
		Command: "bash",
		Args: []string{
			"-c",
			"docker run --rm alpine:latest",
		},
	}, &resp)
	if err != nil {
		t.Errorf("docker run failed: %v\n%s\n%s", err, resp.Stdout, resp.Stderr)
		return
	}

	if resp.ExitCode != 0 {
		t.Errorf("docker run failed: %s\n%s", resp.Stdout, resp.Stderr)
		return
	}
}
