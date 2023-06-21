// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	supervisorapi "github.com/gitpod-io/gitpod/supervisor/api"
	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"
)

func TestRegularWorkspaceTasks(t *testing.T) {
	testRepo := "https://github.com/gitpod-io/empty"
	testRepoName := "empty"
	wsLoc := fmt.Sprintf("/workspace/%s", testRepoName)
	tests := []struct {
		Name        string
		Task        []gitpod.TasksItems
		LookForFile []string
		FF          []wsmanapi.WorkspaceFeatureFlag
	}{
		{
			Name: "classic",
			Task: []gitpod.TasksItems{
				{Init: fmt.Sprintf("touch %s/init-ran; exit", wsLoc)},
				{Before: fmt.Sprintf("touch %s/before-ran; exit", wsLoc)},
				{Command: fmt.Sprintf("touch %s/command-ran; exit", wsLoc)},
			},
			LookForFile: []string{"init-ran", "before-ran", "command-ran"},
		},
	}

	f := features.New("ws-manager").
		WithLabel("component", "ws-manager").
		WithLabel("type", "tasks").
		Assess("it can run workspace tasks", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			for _, test := range tests {
				test := test
				t.Run(test.Name, func(t *testing.T) {
					t.Parallel()

					ctx, cancel := context.WithTimeout(testCtx, time.Duration(5*len(tests))*time.Minute)
					defer cancel()

					api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
					t.Cleanup(func() {
						api.Done(t)
					})

					addInitTask := func(swr *wsmanapi.StartWorkspaceRequest) error {
						tasks, err := json.Marshal(test.Task)
						if err != nil {
							return err
						}
						swr.Spec.Envvars = append(swr.Spec.Envvars, &wsmanapi.EnvironmentVariable{
							Name:  "GITPOD_TASKS",
							Value: string(tasks),
						})
						swr.Spec.FeatureFlags = test.FF
						swr.Spec.Initializer = &csapi.WorkspaceInitializer{
							Spec: &csapi.WorkspaceInitializer_Git{
								Git: &csapi.GitInitializer{
									RemoteUri:        testRepo,
									CheckoutLocation: testRepoName,
									Config:           &csapi.GitConfig{},
								},
							},
						}
						swr.Spec.WorkspaceLocation = testRepoName
						return nil
					}

					// TODO: change to use server API to launch the workspace, so we could run the integration test as the user code flow
					//       which is client -> server -> ws-manager rather than client -> ws-manager directly
					nfo, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(addInitTask))
					if err != nil {
						t.Fatal(err)
					}

					t.Cleanup(func() {
						sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
						defer scancel()

						sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
						defer sapi.Done(t)

						if _, err = stopWs(true, sapi); err != nil {
							t.Errorf("cannot stop workspace: %q", err)
						}
					})

					rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(), integration.WithInstanceID(nfo.Req.Id))
					integration.DeferCloser(t, closer)
					if err != nil {
						t.Fatalf("unexpected error instrumenting workspace: %v", err)
					}
					defer rsa.Close()

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
							Dir:     wsLoc,
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

						if len(parsedResp.Result.Tasks) != len(test.Task) {
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
						Dir: wsLoc,
					}, &ls)
					if err != nil {
						t.Fatal(err)
					}

					for _, lff := range test.LookForFile {
						var foundMaker bool
						for _, f := range ls.Files {
							if f == lff {
								foundMaker = true
								break
							}
						}
						if !foundMaker {
							t.Fatalf("task seems to have run, but cannot find %s it should have created", lff)
						}
					}
				})
			}

			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}
