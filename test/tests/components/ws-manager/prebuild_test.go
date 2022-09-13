// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

func TestPrebuildWorkspaceTaskSuccess(t *testing.T) {
	f := features.New("prebuild").
		WithLabel("component", "ws-manager").
		Assess("it should create a prebuild and succeed the defined tasks", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			tests := []struct {
				Name             string
				ContextURL       string
				WorkspaceRoot    string
				CheckoutLocation string
				Task             []gitpod.TasksItems
				FF               []wsmanapi.WorkspaceFeatureFlag
			}{
				{
					Name:             "classic",
					ContextURL:       "https://github.com/gitpod-io/empty",
					CheckoutLocation: "empty",
					WorkspaceRoot:    "/workspace/empty",
					Task: []gitpod.TasksItems{
						{Init: "echo \"some output\" > someFile; sleep 20; exit 0;"},
					},
				},
				{
					Name:             "pvc",
					ContextURL:       "https://github.com/gitpod-io/empty",
					CheckoutLocation: "empty",
					WorkspaceRoot:    "/workspace/empty",
					Task: []gitpod.TasksItems{
						{Init: "echo \"some output\" > someFile; sleep 20; exit 0;"},
					},
					FF: []wsmanapi.WorkspaceFeatureFlag{wsmanapi.WorkspaceFeatureFlag_PERSISTENT_VOLUME_CLAIM},
				},
			}
			ctx, cancel := context.WithTimeout(context.Background(), time.Duration(5*len(tests))*time.Minute)
			defer cancel()

			for _, test := range tests {
				t.Run(test.Name, func(t *testing.T) {
					api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
					t.Cleanup(func() {
						api.Done(t)
					})

					_, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
						req.Type = wsmanapi.WorkspaceType_PREBUILD

						tasks, err := json.Marshal(test.Task)
						if err != nil {
							return err
						}
						req.Spec.Envvars = append(req.Spec.Envvars, &wsmanapi.EnvironmentVariable{
							Name:  "GITPOD_TASKS",
							Value: string(tasks),
						})

						req.Spec.FeatureFlags = test.FF
						req.Spec.Initializer = &csapi.WorkspaceInitializer{
							Spec: &csapi.WorkspaceInitializer_Git{
								Git: &csapi.GitInitializer{
									RemoteUri:        test.ContextURL,
									TargetMode:       csapi.CloneTargetMode_REMOTE_BRANCH,
									CloneTaget:       "main",
									CheckoutLocation: test.CheckoutLocation,
									Config:           &csapi.GitConfig{},
								},
							},
						}
						req.Spec.WorkspaceLocation = test.CheckoutLocation
						return nil
					}))
					if err != nil {
						t.Fatalf("cannot launch a workspace: %q", err)
					}
					defer func() {
						sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
						defer scancel()

						sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
						defer sapi.Done(t)

						_, err = stopWs(true, sapi)
						if err != nil {
							t.Errorf("cannot stop workspace: %q", err)
						}
					}()
				})
			}
			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}

func TestPrebuildWorkspaceTaskFail(t *testing.T) {
	t.Skip("status never returns HeadlessTaskFailed (exit 1)")

	f := features.New("prebuild").
		WithLabel("component", "server").
		Assess("it should create a prebuild and fail after running the defined tasks", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			ws, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
				req.Type = wsmanapi.WorkspaceType_PREBUILD
				req.Spec.Envvars = append(req.Spec.Envvars, &wsmanapi.EnvironmentVariable{
					Name:  "GITPOD_TASKS",
					Value: `[{ "init": "echo \"some output\" > someFile; sleep 20; exit 1;" }]`,
				})
				return nil
			}))
			if err != nil {
				t.Fatalf("cannot start workspace: %q", err)
			}

			defer func() {
				sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
				defer scancel()

				sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
				defer sapi.Done(t)

				_, err = stopWs(true, sapi)
				if err != nil {
					t.Fatal(err)
				}
			}()

			_, err = integration.WaitForWorkspace(ctx, api, ws.Req.Id, func(status *wsmanapi.WorkspaceStatus) bool {
				if status.Phase != wsmanapi.WorkspacePhase_STOPPED {
					return false
				}
				if status.Conditions.HeadlessTaskFailed == "" {
					t.Logf("Conditions: %v", status.Conditions)
					t.Fatal("expected HeadlessTaskFailed condition")
				}
				return true
			})
			if err != nil {
				t.Fatalf("cannot start workspace: %q", err)
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}

const (
	prebuildLogPath string = "/workspace/.gitpod"
	prebuildLog     string = "'🤙 This task ran as a workspace prebuild'"
)

func TestOpenWorkspaceFromPrebuild(t *testing.T) {
	f := features.New("prebuild").
		WithLabel("component", "ws-manager").
		Assess("it should open workspace from prebuild successfully", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			tests := []struct {
				Name             string
				ContextURL       string
				WorkspaceRoot    string
				CheckoutLocation string
				FF               []wsmanapi.WorkspaceFeatureFlag
			}{
				{
					Name:             "classic",
					ContextURL:       "https://github.com/gitpod-io/empty",
					CheckoutLocation: "empty",
					WorkspaceRoot:    "/workspace/empty",
				},
				{
					Name:             "pvc",
					ContextURL:       "https://github.com/gitpod-io/empty",
					CheckoutLocation: "empty",
					WorkspaceRoot:    "/workspace/empty",
					FF:               []wsmanapi.WorkspaceFeatureFlag{wsmanapi.WorkspaceFeatureFlag_PERSISTENT_VOLUME_CLAIM},
				},
			}

			ctx, cancel := context.WithTimeout(context.Background(), time.Duration(10*len(tests))*time.Minute)
			defer cancel()

			for _, test := range tests {
				t.Run(test.Name, func(t *testing.T) {
					api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
					t.Cleanup(func() {
						api.Done(t)
					})

					// create a prebuild and stop workspace
					_, prebuildStopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
						req.Type = wsmanapi.WorkspaceType_PREBUILD
						req.Spec.Envvars = append(req.Spec.Envvars, &wsmanapi.EnvironmentVariable{
							Name:  "GITPOD_TASKS",
							Value: `[{ "init": "echo \"some output\" > someFile; sleep 60; exit 0;" }]`,
						})
						req.Spec.FeatureFlags = test.FF
						req.Spec.Initializer = &csapi.WorkspaceInitializer{
							Spec: &csapi.WorkspaceInitializer_Git{
								Git: &csapi.GitInitializer{
									RemoteUri:        test.ContextURL,
									TargetMode:       csapi.CloneTargetMode_REMOTE_BRANCH,
									CloneTaget:       "main",
									CheckoutLocation: test.CheckoutLocation,
									Config:           &csapi.GitConfig{},
								},
							},
						}
						req.Spec.WorkspaceLocation = test.CheckoutLocation
						return nil
					}))
					if err != nil {
						t.Fatalf("cannot launch a workspace: %q", err)
					}

					prebuildSnapshot, vsInfo, err := stopWorkspaceAndFindSnapshot(prebuildStopWs, api)
					if err != nil {
						t.Fatalf("stop workspace and find snapshot error: %v", err)
					}

					// launch the workspace from prebuild
					ws, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
						req.Spec.FeatureFlags = test.FF
						req.Spec.Initializer = &csapi.WorkspaceInitializer{
							Spec: &csapi.WorkspaceInitializer_Prebuild{
								Prebuild: &csapi.PrebuildInitializer{
									Prebuild: &csapi.SnapshotInitializer{
										Snapshot:           prebuildSnapshot,
										FromVolumeSnapshot: reflect.DeepEqual(test.FF, []wsmanapi.WorkspaceFeatureFlag{wsmanapi.WorkspaceFeatureFlag_PERSISTENT_VOLUME_CLAIM}),
									},
									Git: []*csapi.GitInitializer{
										{
											RemoteUri:        test.ContextURL,
											TargetMode:       csapi.CloneTargetMode_REMOTE_BRANCH,
											CloneTaget:       "main",
											CheckoutLocation: test.CheckoutLocation,
											Config:           &csapi.GitConfig{},
										},
									},
								},
							},
						}
						req.Spec.VolumeSnapshot = vsInfo
						req.Spec.WorkspaceLocation = test.CheckoutLocation
						return nil
					}))
					if err != nil {
						t.Fatalf("cannot launch a workspace: %q", err)
					}

					defer func() {
						// stop workspace in defer function to prevent we forget to stop the workspace
						if err := stopWorkspace(t, cfg, stopWs); err != nil {
							t.Errorf("cannot stop workspace: %q", err)
						}
					}()

					rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(),
						integration.WithInstanceID(ws.Req.Id),
					)
					if err != nil {
						t.Fatal(err)
					}
					t.Cleanup(func() {
						rsa.Close()
					})
					integration.DeferCloser(t, closer)

					// check prebuild log message exists
					var resp agent.ExecResponse
					var checkPrebuildSuccess bool
					for i := 0; i < 10; i++ {
						err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
							Dir:     prebuildLogPath,
							Command: "bash",
							Args: []string{
								"-c",
								fmt.Sprintf("grep %s *", prebuildLog),
							},
						}, &resp)
						if err == nil && resp.ExitCode == 0 && strings.Trim(resp.Stdout, " \t\n") != "" {
							checkPrebuildSuccess = true
							break
						}

						// wait 3 seconds and check
						time.Sleep(3 * time.Second)
					}

					if !checkPrebuildSuccess {
						t.Fatalf("cannot found the prebuild message %s in %s, err:%v, exitCode:%d, stdout:%s", prebuildLog, prebuildLogPath, err, resp.ExitCode, resp.Stdout)
					}

					// write file foobar.txt and stop the workspace
					err = rsa.Call("WorkspaceAgent.WriteFile", &agent.WriteFileRequest{
						Path:    fmt.Sprintf("%s/foobar.txt", test.WorkspaceRoot),
						Content: []byte("hello world"),
						Mode:    0644,
					}, &resp)
					if err != nil {
						t.Fatalf("cannot write file %s", fmt.Sprintf("%s/foobar.txt", test.WorkspaceRoot))
					}

					sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
					defer scancel()

					sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
					defer sapi.Done(t)

					// stop workspace to get the volume snapshot information
					_, vsInfo, err = stopWorkspaceAndFindSnapshot(stopWs, sapi)
					if err != nil {
						t.Fatal(err)
					}

					// reopen the workspace and make sure the file foobar.txt exists
					ws1, stopWs1, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
						req.ServicePrefix = ws.Req.ServicePrefix
						req.Metadata.MetaId = ws.Req.Metadata.MetaId
						req.Metadata.Owner = ws.Req.Metadata.Owner
						req.Spec.FeatureFlags = test.FF
						req.Spec.Initializer = &csapi.WorkspaceInitializer{
							Spec: &csapi.WorkspaceInitializer_Backup{
								Backup: &csapi.FromBackupInitializer{
									CheckoutLocation:   test.CheckoutLocation,
									FromVolumeSnapshot: reflect.DeepEqual(test.FF, []wsmanapi.WorkspaceFeatureFlag{wsmanapi.WorkspaceFeatureFlag_PERSISTENT_VOLUME_CLAIM}),
								},
							},
						}
						req.Spec.VolumeSnapshot = vsInfo
						req.Spec.WorkspaceLocation = test.CheckoutLocation
						return nil
					}))
					if err != nil {
						t.Fatalf("cannot launch a workspace: %q", err)
					}

					defer func() {
						// stop workspace in defer function to prevent we forget to stop the workspace
						if err := stopWorkspace(t, cfg, stopWs1); err != nil {
							t.Errorf("cannot stop workspace: %q", err)
						}
					}()

					rsa, closer, err = integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(),
						integration.WithInstanceID(ws1.Req.Id),
					)
					if err != nil {
						t.Fatal(err)
					}
					integration.DeferCloser(t, closer)

					var ls agent.ListDirResponse
					err = rsa.Call("WorkspaceAgent.ListDir", &agent.ListDirRequest{
						Dir: test.WorkspaceRoot,
					}, &ls)
					if err != nil {
						t.Fatal(err)
					}
					rsa.Close()

					var found bool
					for _, f := range ls.Files {
						if filepath.Base(f) == "foobar.txt" {
							found = true
							break
						}
					}
					if !found {
						t.Fatal("did not find foobar.txt from previous workspace instance")
					}
				})
			}
			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}

func stopWorkspaceAndFindSnapshot(StopWorkspaceFunc integration.StopWorkspaceFunc, api *integration.ComponentAPI) (string, *wsmanapi.VolumeSnapshotInfo, error) {
	lastStatus, err := StopWorkspaceFunc(true, api)
	if err != nil {
		return "", nil, err
	}
	if lastStatus == nil && lastStatus.Conditions == nil {
		return "", nil, nil
	}
	return lastStatus.Conditions.Snapshot, lastStatus.Conditions.VolumeSnapshot, nil
}

func stopWorkspace(t *testing.T, cfg *envconf.Config, StopWorkspaceFunc integration.StopWorkspaceFunc) error {
	sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer scancel()

	sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
	defer sapi.Done(t)

	_, err := StopWorkspaceFunc(true, sapi)
	return err
}
