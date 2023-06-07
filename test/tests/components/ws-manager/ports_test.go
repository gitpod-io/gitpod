// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"strings"
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
	userToken, _ := os.LookupEnv("USER_TOKEN")
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)

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
				// TODO: Remove
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

					userId, err := api.CreateUser(username, userToken)
					if err != nil {
						t.Fatal(err)
					}

					// TODO: Set supervisor image?
					addPorts := func(swr *wsmanapi.StartWorkspaceRequest) error {
						tokenId, err := api.CreateOAuth2Token(username, []string{
							"function:getToken",
							"function:openPort",
							"function:closePort",
							"function:getOpenPorts",
							"function:guessGitTokenScopes",
							"function:getWorkspace",
							"function:trackEvent",
							"resource:token::*::get",
							fmt.Sprintf("resource:workspace::%s::get/update", swr.Metadata.MetaId),
						})
						if err != nil {
							t.Fatal(err)
						}

						swr.Spec.Initializer = &csapi.WorkspaceInitializer{
							Spec: &csapi.WorkspaceInitializer_Git{
								Git: &csapi.GitInitializer{
									RemoteUri:        testRepo,
									CheckoutLocation: testRepoName,
									Config:           &csapi.GitConfig{},
								},
							},
						}
						swr.Spec.Envvars = append(swr.Spec.Envvars,
							&wsmanapi.EnvironmentVariable{
								Name:  "GITPOD_TASKS",
								Value: `[{ "command": "python3 -m http.server 3000" }]`,
							},
							&wsmanapi.EnvironmentVariable{
								Name:  "SUPERVISOR_ADDR",
								Value: `10.0.5.2:22999`,
							},
							&wsmanapi.EnvironmentVariable{
								Name: "THEIA_SUPERVISOR_TOKENS",
								Value: fmt.Sprintf(`[{
									"token": "%v",
									"kind": "gitpod",
									"host": "%v",
									"scope": ["function:getToken", "function:openPort", "function:closePort", "function:getOpenPorts", "function:guessGitTokenScopes", "function:getWorkspace", "function:trackEvent", "resource:token::*::get", "resource:workspace::%s::get/update"],
									"expiryDate": "2022-10-26T10:38:05.232Z",
									"reuse": 2
								}]`, tokenId, getHostUrl(ctx, t, cfg.Client(), cfg.Namespace()), swr.Metadata.MetaId),
							},
						)
						// for _, port := range test.Ports {
						// 	port := port
						// 	swr.Spec.Ports = append(swr.Spec.Ports, port)
						// }
						swr.Metadata.Owner = userId
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

					// t.Logf("all tasks completed, listing ports...")
					type Port struct {
						LocalPort int `json:"localPort,omitempty"`
						Exposed   struct {
							Visibility string `json:"visibility,omitempty"`
							Url        string `json:"url,omitempty"`
						} `json:"exposed,omitempty"`
					}
					var portsResp struct {
						Result struct {
							Ports []*Port `json:"ports,omitempty"`
						} `json:"result"`
					}
					time.Sleep(3 * time.Second)

					// Wait for port auto-detection to pick up the open port.
					time.Sleep(4 * time.Second)

					expectPort := func(expected Port) {
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

						t.Logf("ports: %s (%d)", res.Stdout, res.ExitCode)
						if len(portsResp.Result.Ports) != 1 {
							t.Fatalf("expected one port to be open, but got %d", len(portsResp.Result.Ports))
						}
						if !reflect.DeepEqual(expected, *portsResp.Result.Ports[0]) {
							t.Fatalf("expected %v but got %v", expected, *portsResp.Result.Ports[0])
						}
					}

					expectPort(Port{
						LocalPort: 3000,
						Exposed: struct {
							Visibility string `json:"visibility,omitempty"`
							Url        string `json:"url,omitempty"`
						}{
							Visibility: "private",
							Url:        fmt.Sprintf("https://%d-%s", 3000, strings.TrimPrefix(nfo.LastStatus.Spec.Url, "https://")),
						},
					})

					// Make port public.
					// TODO:  ports_test.go:263: gp CLI output: , failed to change port visibility: jsonrpc2: code 404 message: Workspace not found.
					// TODO: Call ws-manager component directly to open port?
					time.Sleep(30 * time.Second)
					var res1 agent.ExecResponse
					err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
						Dir:     wsLoc,
						Command: "gp",
						// nftable rule only forwards to this ip address
						Args: []string{"ports", "visibility", "3000:public"},
					}, &res1)
					if err != nil {
						t.Fatal(err)
					}
					t.Logf("gp CLI output: %s, %s, %d", res1.Stdout, res1.Stderr, res1.ExitCode)

					expectPort(Port{
						LocalPort: 3000,
						Exposed: struct {
							Visibility string `json:"visibility,omitempty"`
							Url        string `json:"url,omitempty"`
						}{
							Visibility: "public",
							Url:        fmt.Sprintf("https://%d-%s", 3000, strings.TrimPrefix(nfo.LastStatus.Spec.Url, "https://")),
						},
					})

					// TODO: Curl public port
				})
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
