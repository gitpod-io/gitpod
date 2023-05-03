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
	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"
)

func TestRegularWorkspacePorts(t *testing.T) {
	testRepo := "https://github.com/gitpod-io/empty"
	testRepoName := "empty"
	wsLoc := fmt.Sprintf("/workspace/%s", testRepoName)
	tests := []struct {
		Name  string
		Ports []*wsmanapi.PortSpec
	}{
		{
			Name: "private",
			Ports: []*wsmanapi.PortSpec{
				{Port: 3000, Visibility: wsmanapi.PortVisibility_PORT_VISIBILITY_PRIVATE},
				{Port: 3001, Visibility: wsmanapi.PortVisibility_PORT_VISIBILITY_PUBLIC},
			},
		},
	}

	f := features.New("ws-manager").
		WithLabel("component", "ws-manager").
		WithLabel("type", "ports").
		Assess("it can open and access workspace ports", func(ctx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			for _, test := range tests {
				test := test
				t.Run(test.Name, func(t *testing.T) {
					t.Parallel()

					ctx, cancel := context.WithTimeout(context.Background(), time.Duration(5*len(tests))*time.Minute)
					defer cancel()

					api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
					t.Cleanup(func() {
						api.Done(t)
					})
					addPorts := func(swr *wsmanapi.StartWorkspaceRequest) error {
						swr.Spec.Initializer = &csapi.WorkspaceInitializer{
							Spec: &csapi.WorkspaceInitializer_Git{
								Git: &csapi.GitInitializer{
									RemoteUri:        testRepo,
									CheckoutLocation: testRepoName,
									Config:           &csapi.GitConfig{},
								},
							},
						}
						swr.Spec.Envvars = append(swr.Spec.Envvars, &wsmanapi.EnvironmentVariable{
							Name:  "GITPOD_TASKS",
							Value: "[{\"command\":\"python3 -m http.server 3000\"}]",
						})
						for _, port := range test.Ports {
							port := port
							swr.Spec.Ports = append(swr.Spec.Ports, port)
						}
						swr.Spec.WorkspaceLocation = testRepoName
						return nil
					}

					// TODO: change to use server API to launch the workspace, so we could run the integration test as the user code flow
					//       which is client -> server -> ws-manager rather than client -> ws-manager directly
					nfo, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(addPorts))
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

					// var parsedResp struct {
					// 	Result struct {
					// 		Tasks []*struct {
					// 			State string `json:"state,omitempty"`
					// 		} `json:"tasks,omitempty"`
					// 	} `json:"result"`
					// }
					// supervisorTaskStatusCompleted := false
					// for i := 1; i < 10; i++ {
					// 	var res agent.ExecResponse
					// 	err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
					// 		Dir:     wsLoc,
					// 		Command: "curl",
					// 		// nftable rule only forwards to this ip address
					// 		Args: []string{"10.0.5.2:22999/_supervisor/v1/status/tasks"},
					// 	}, &res)
					// 	if err != nil {
					// 		t.Fatal(err)
					// 	}
					// 	err = json.Unmarshal([]byte(res.Stdout), &parsedResp)
					// 	if err != nil {
					// 		t.Fatalf("cannot decode supervisor status response: %s", err)
					// 	}

					// 	if len(parsedResp.Result.Tasks) != len(task) {
					// 		t.Fatalf("expected one task to run, but got %d", len(parsedResp.Result.Tasks))
					// 	}
					// 	allCompleted := true
					// 	for i, task := range parsedResp.Result.Tasks {
					// 		if task.State != supervisorapi.TaskState_name[int32(supervisorapi.TaskState_closed)] {
					// 			allCompleted = false
					// 			t.Logf("waiting for task %d to close, is %s", i, task.State)
					// 			break
					// 		}
					// 	}
					// 	if allCompleted {
					// 		supervisorTaskStatusCompleted = true
					// 		break
					// 	}

					// 	// sleep before next attempt hoping that the task completed meanwhile
					// 	time.Sleep(6 * time.Second)
					// }
					// if !supervisorTaskStatusCompleted {
					// 	t.Fatal("tasks did not complete in time")
					// }

					t.Logf("all tasks completed, listing ports...")
					var portsResp struct {
						Result struct {
							Ports []*struct {
								LocalPort int `json:"localPort,omitempty"`
								Exposed   struct {
									Visibility string `json:"visibility,omitempty"`
									Url        string `json:"url,omitempty"`
								} `json:"exposed,omitempty"`
							} `json:"ports,omitempty"`
						} `json:"result"`
					}
					time.Sleep(10 * time.Second)
					var res agent.ExecResponse
					err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
						Dir:     wsLoc,
						Command: "curl",
						// nftable rule only forwards to this ip address
						Args: []string{"10.0.5.2:22999/_supervisor/v1/status/ports"},
					}, &res)
					if err != nil {
						t.Fatal(err)
					}
					err = json.Unmarshal([]byte(res.Stdout), &portsResp)
					if err != nil {
						t.Fatalf("cannot decode supervisor ports status response: %s", err)
					}
					// time.Sleep(1 * time.Minute)
					if len(portsResp.Result.Ports) != len(test.Ports) {
						t.Fatalf("expected %d ports, but got %d. Full response: %s (exit code %d)", len(test.Ports), len(portsResp.Result.Ports), res.Stdout, res.ExitCode)
					}

					for _, p := range portsResp.Result.Ports {
						for _, testPort := range test.Ports {
							if p.LocalPort == int(testPort.Port) {
								vis := wsmanapi.PortVisibility_name[int32(testPort.Visibility)]
								if p.Exposed.Visibility != vis {
									t.Fatalf("expected port visibility %s for %d, but was %s", vis, p.LocalPort, p.Exposed.Visibility)
								}
								// TODO: Test URL
								break
							}
						}
						t.Fatalf("found unexpected port %d, not part of test", p.LocalPort)
					}
				})
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
