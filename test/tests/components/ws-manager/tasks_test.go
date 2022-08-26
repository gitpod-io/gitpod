// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	supervisorapi "github.com/gitpod-io/gitpod/supervisor/api"
	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"
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

	f := features.New("ws-manager").
		WithLabel("component", "ws-manager").
		WithLabel("type", "tasks").
		Assess("it can run workspace tasks", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			for _, test := range tests {
				t.Run(test.Name, func(t *testing.T) {
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

					nfo, err := integration.LaunchWorkspaceDirectly(ctx, api, integration.WithRequestModifier(addInitTask))
					if err != nil {
						t.Fatal(err)
					}

					t.Cleanup(func() {
						err = integration.DeleteWorkspace(ctx, api, nfo.Req.Id)
						if err == nil {
							_, _ = integration.WaitForWorkspaceStop(ctx, api, nfo.Req.Id)
						}
					})

					rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(), integration.WithInstanceID(nfo.Req.Id))
					if err != nil {
						t.Fatalf("unexpected error instrumenting workspace: %v", err)
					}
					defer rsa.Close()
					integration.DeferCloser(t, closer)

					var parsedResp struct {
						Result struct {
							Tasks []*struct {
								State string `json:"state,omitempty"`
							} `json:"tasks,omitempty"`
						} `json:"result"`
					}
					supervisorTaskStatusCompleted := false
					for i := 1; i < 10; i++ {
						var res agent.ExecResponse
						err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
							Dir:     "/workspace",
							Command: "curl",
							// nftable rule only forwards to this ip address
							Args: []string{"10.0.5.2:22999/_supervisor/v1/status/tasks"},
						}, &res)
						if err != nil {
							t.Fatal(err)
						}
						err = json.Unmarshal([]byte(res.Stdout), &parsedResp)
						if err != nil {
							t.Fatalf("cannot decode supervisor status response: %s", err)
						}

						if len(parsedResp.Result.Tasks) != 1 {
							t.Fatalf("expected one task to run, but got %d", len(parsedResp.Result.Tasks))
						}
						if parsedResp.Result.Tasks[0].State == supervisorapi.TaskState_name[int32(supervisorapi.TaskState_closed)] {
							supervisorTaskStatusCompleted = true
							break
						}
						// sleep before next attempt hoping that the task completed meanwhile
						time.Sleep(6 * time.Second)
					}
					if !supervisorTaskStatusCompleted {
						t.Fatal("tasks did not complete in time")
					}

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

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
