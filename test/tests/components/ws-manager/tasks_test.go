// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
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

	f := features.New("ws-manager").
		WithLabel("component", "ws-manager").
		WithLabel("type", "tasks").
		Assess("it can run workspace tasks", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			for _, test := range tests {
				t.Run(test.Name, func(t *testing.T) {
					// t.Parallel()

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
						_ = integration.DeleteWorkspace(ctx, api, nfo.Req.Id)
					})

					conn, err := api.Supervisor(nfo.Req.Id)
					if err != nil {
						t.Fatal(err)
					}

					tsctx, tscancel := context.WithTimeout(ctx, 60*time.Second)
					defer tscancel()

					statusService := supervisor.NewStatusServiceClient(conn)
					resp, err := statusService.TasksStatus(tsctx, &supervisor.TasksStatusRequest{Observe: false})
					if err != nil {
						t.Fatal(err)
					}

					for {
						status, err := resp.Recv()
						if errors.Is(err, io.EOF) {
							break
						}

						if err != nil {
							t.Fatal(err)
						}
						if len(status.Tasks) != 1 {
							t.Fatalf("expected one task to run, but got %d", len(status.Tasks))
						}
						if status.Tasks[0].State == supervisor.TaskState_closed {
							break
						}
					}

					rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), cfg.Client(), integration.WithInstanceID(nfo.Req.Id))
					if err != nil {
						t.Fatalf("unexpected error instrumenting workspace: %v", err)
					}
					defer rsa.Close()
					integration.DeferCloser(t, closer)

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
