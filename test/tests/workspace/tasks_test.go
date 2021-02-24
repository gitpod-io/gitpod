// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	agent "github.com/gitpod-io/gitpod/test/tests/workspace/workspace_agent/api"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

func TestRegularWorkspaceTasks(t *testing.T) {
	tests := []struct {
		Name        string
		Task        gitpod.TasksItems
		LookForFile string
	}{
		{
			Name:        "init",
			Task:        gitpod.TasksItems{Init: "touch /workspace/init-ran; exit"},
			LookForFile: "init-ran",
		},
		{
			Name:        "before",
			Task:        gitpod.TasksItems{Before: "touch /workspace/before-ran; exit"},
			LookForFile: "before-ran",
		},
		{
			Name:        "command",
			Task:        gitpod.TasksItems{Command: "touch /workspace/command-ran; exit"},
			LookForFile: "command-ran",
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			t.Parallel()

			it := integration.NewTest(t)
			defer it.Done()

			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			addInitTask := func(swr *wsmanapi.StartWorkspaceRequest) error {
				tasks, err := json.Marshal([]gitpod.TasksItems{test.Task})
				if err != nil {
					return err
				}
				swr.Spec.Envvars = append(swr.Spec.Envvars, &wsmanapi.EnvironmentVariable{
					Name:  "GITPOD_TASKS",
					Value: string(tasks),
				})
				return nil
			}

			nfo := integration.LaunchWorkspaceDirectly(it, ctx,
				integration.WithRequestModifier(addInitTask),
			)
			defer integration.DeleteWorkspace(it, ctx, nfo.Req.Id)

			conn := it.API().Supervisor(nfo.Req.Id)
			statusService := supervisor.NewStatusServiceClient(conn)

			tsctx, tscancel := context.WithTimeout(ctx, 60*time.Second)
			defer tscancel()
			resp, err := statusService.TasksStatus(tsctx, &supervisor.TasksStatusRequest{Observe: false})
			if err != nil {
				t.Fatal(err)
			}

			for {
				status, err := resp.Recv()
				if err != nil {
					t.Fatal(err)
					return
				}
				if len(status.Tasks) != 1 {
					t.Fatalf("expected one task to run, but got %d", len(status.Tasks))
				}
				if status.Tasks[0].State == supervisor.TaskState_closed {
					break
				}
			}

			rsa, err := it.Instrument(integration.ComponentWorkspace, "workspace", integration.WithInstanceID(nfo.Req.Id))
			if err != nil {
				t.Fatal(err)
			}
			defer rsa.Close()

			var ls agent.ListDirResponse
			err = rsa.Call("WorkspaceAgent.ListDir", &agent.ListDirRequest{
				Dir: "/workspace",
			}, &ls)
			if err != nil {
				t.Fatal(err)
			}

			var foundMaker bool
			for _, f := range ls.Files {
				t.Logf("file in workspace: %s", f)
				if f == test.LookForFile {
					foundMaker = true
					break
				}
			}
			if !foundMaker {
				t.Fatal("task seems to have run, but cannot find the file it should have created")
			}
		})
	}
}
