// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
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
		Assess("it should create a prebuild and succeed the defined tasks", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
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
						{Init: "echo \"some output\" > someFile; exit 0;"},
					},
				},
			}
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

					// TODO: change to use server API to launch the workspace, so we could run the integration test as the user code flow
					//       which is client -> server -> ws-manager rather than client -> ws-manager directly
					ws, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
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
									CheckoutLocation: test.CheckoutLocation,
									Config:           &csapi.GitConfig{},
								},
							},
						}
						req.Spec.WorkspaceLocation = test.CheckoutLocation
						return nil
					}), integration.WithWaitWorkspaceForOpts(integration.WaitForStopped))
					if err != nil {
						t.Fatalf("cannot launch a workspace: %q", err)
					}
					t.Cleanup(func() {
						// stop workspace in defer function to prevent we forget to stop the workspace
						if err := stopWorkspace(t, cfg, stopWs); err != nil {
							t.Errorf("cannot stop workspace: %q", err)
						}
					})

					if ws.LastStatus == nil {
						t.Fatal("workspace status is nil")
					}
					if ws.LastStatus.Phase != wsmanapi.WorkspacePhase_STOPPED {
						t.Fatalf("unexpected workspace phase: %v", ws.LastStatus.Phase)
					}
					if ws.LastStatus.Conditions != nil && ws.LastStatus.Conditions.HeadlessTaskFailed != "" {
						t.Logf("Conditions: %v", ws.LastStatus.Conditions)
						t.Fatalf("unexpected HeadlessTaskFailed condition: %v", ws.LastStatus.Conditions.HeadlessTaskFailed)
					}
				})
			}
			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}

func TestPrebuildWorkspaceTaskFail(t *testing.T) {
	f := features.New("prebuild").
		WithLabel("component", "server").
		Assess("it should create a prebuild and fail after running the defined tasks", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			t.Parallel()

			ctx, cancel := context.WithTimeout(testCtx, 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			ws, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
				req.Type = wsmanapi.WorkspaceType_PREBUILD
				req.Spec.Envvars = append(req.Spec.Envvars, &wsmanapi.EnvironmentVariable{
					Name:  "GITPOD_TASKS",
					Value: `[{ "init": "echo \"some output\" > someFile; exit 1;" }]`,
				})
				return nil
			}), integration.WithWaitWorkspaceForOpts(integration.WaitForStopped))
			if err != nil {
				t.Fatalf("cannot start workspace: %q", err)
			}

			t.Cleanup(func() {
				// stop workspace in defer function to prevent we forget to stop the workspace
				if err := stopWorkspace(t, cfg, stopWs); err != nil {
					t.Errorf("cannot stop workspace: %q", err)
				}
			})

			if ws.LastStatus == nil {
				t.Fatal("workspace status is nil")
			}
			if ws.LastStatus.Phase != wsmanapi.WorkspacePhase_STOPPED {
				t.Fatalf("unexpected workspace phase: %v", ws.LastStatus.Phase)
			}
			if ws.LastStatus.Conditions == nil || ws.LastStatus.Conditions.HeadlessTaskFailed == "" {
				t.Logf("Status: %v", ws.LastStatus)
				t.Fatal("expected HeadlessTaskFailed condition")
			}

			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}

const (
	prebuildLogPath string = "/workspace/.gitpod"
	prebuildLog     string = "'🍊 This task ran as a workspace prebuild'"
	initTask        string = "echo \"some output\" > someFile;"
	regularPrefix   string = "ws-"
)

// TestOpenWorkspaceFromPrebuild
// - create a prebuild
// - stop the prebuild workspace
// - open the regular workspace from prebuild
// - make sure either one of the condition mets
//   - the prebuild log message exists
//   - the init task message exists
//   - the init task generated file exists
//
// - make sure the .git/ folder with correct permission
// - write a new file foobar.txt
// - stop the regular workspace
// - relaunch the regular workspace
// - make sure the file foobar.txt exists
func TestOpenWorkspaceFromPrebuild(t *testing.T) {
	f := features.New("prebuild").
		WithLabel("component", "ws-manager").
		Assess("it should open workspace from prebuild successfully", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
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
			}

			for _, test := range tests {
				test := test
				t.Run(test.Name, func(t *testing.T) {
					t.Parallel()

					ctx, cancel := context.WithTimeout(testCtx, time.Duration(10*len(tests))*time.Minute)
					defer cancel()

					api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
					t.Cleanup(func() {
						api.Done(t)
					})

					var prebuildSnapshot string
					func() {
						// create a prebuild and stop workspace
						// TODO: change to use server API to launch the workspace, so we could run the integration test as the user code flow
						//       which is client -> server -> ws-manager rather than client -> ws-manager directly
						ws, prebuildStopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api,
							integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
								req.Type = wsmanapi.WorkspaceType_PREBUILD
								req.Spec.Envvars = append(req.Spec.Envvars, &wsmanapi.EnvironmentVariable{
									Name:  "GITPOD_TASKS",
									Value: fmt.Sprintf(`[{ "init": %q }]`, initTask),
								})
								req.Spec.FeatureFlags = test.FF
								req.Spec.Initializer = &csapi.WorkspaceInitializer{
									Spec: &csapi.WorkspaceInitializer_Git{
										Git: &csapi.GitInitializer{
											RemoteUri:        test.ContextURL,
											CheckoutLocation: test.CheckoutLocation,
											Config:           &csapi.GitConfig{},
										},
									},
								}
								req.Spec.WorkspaceLocation = test.CheckoutLocation
								return nil
							}),
							// Wait for the prebuild to finish, as this can happen quickly before we
							// would have time to observe the workspace to stop and get its status.
							integration.WithWaitWorkspaceForOpts(integration.WaitForStopped),
						)
						if err != nil {
							t.Fatalf("cannot launch a workspace: %q", err)
						}
						defer func() {
							if err := stopWorkspace(t, cfg, prebuildStopWs); err != nil {
								t.Errorf("cannot stop workspace: %q", err)
							}
						}()

						prebuildSnapshot, _, err = findSnapshotFromStoppedWs(t, ctx, ws.LastStatus)
						if err != nil {
							_ = stopWorkspace(t, cfg, prebuildStopWs)
							t.Fatalf("stop workspace and find snapshot error: %v", err)
						}

						t.Logf("prebuild snapshot: %s", prebuildSnapshot)

						// check the prebuild logs have been uploaded
						checkPrebuildLogUploaded(t, ctx, api, ws)
					}()

					// launch the workspace from prebuild
					// TODO: change to use server API to launch the workspace, so we could run the integration test as the user code flow
					//       which is client -> server -> ws-manager rather than client -> ws-manager directly
					ws, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
						req.Spec.FeatureFlags = test.FF
						req.Spec.Initializer = &csapi.WorkspaceInitializer{
							Spec: &csapi.WorkspaceInitializer_Prebuild{
								Prebuild: &csapi.PrebuildInitializer{
									Prebuild: &csapi.SnapshotInitializer{
										Snapshot:           prebuildSnapshot,
										FromVolumeSnapshot: false,
									},
									Git: []*csapi.GitInitializer{
										{
											RemoteUri:        test.ContextURL,
											CheckoutLocation: test.CheckoutLocation,
											Config:           &csapi.GitConfig{},
										},
									},
								},
							},
						}

						req.Spec.WorkspaceLocation = test.CheckoutLocation
						return nil
					}))
					if err != nil {
						t.Fatalf("cannot launch a workspace: %q", err)
					}

					t.Cleanup(func() {
						// stop workspace in defer function to prevent we forget to stop the workspace
						if err := stopWorkspace(t, cfg, stopWs); err != nil {
							t.Errorf("cannot stop workspace: %q", err)
						}
					})

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
					checkPrebuildLogExist(t, cfg, rsa, ws, test.WorkspaceRoot)

					// check the folder permission is gitpod
					checkFolderPermission(t, rsa, "/workspace")

					// check the files/folders permission under .git/ is gitpod
					checkGitFolderPermission(t, rsa, test.WorkspaceRoot)

					// write file foobar.txt and stop the workspace
					var writeFileResp agent.ExecResponse
					err = rsa.Call("WorkspaceAgent.WriteFile", &agent.WriteFileRequest{
						Path:    fmt.Sprintf("%s/foobar.txt", test.WorkspaceRoot),
						Content: []byte("hello world"),
						Mode:    0644,
					}, &writeFileResp)
					if err != nil {
						t.Fatalf("cannot write file %s", fmt.Sprintf("%s/foobar.txt", test.WorkspaceRoot))
					}

					sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
					defer scancel()

					sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
					defer sapi.Done(t)

					// stop workspace without wait
					_, err = stopWs(false, sapi)
					if err != nil {
						t.Fatal(err)
					}

					// reopen the workspace and make sure the file foobar.txt exists
					ws1, stopWs1, err := integration.LaunchWorkspaceDirectly(t, ctx, sapi, integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
						req.ServicePrefix = ws.Req.ServicePrefix
						req.Metadata.MetaId = ws.Req.Metadata.MetaId
						req.Metadata.Owner = ws.Req.Metadata.Owner
						req.Spec.FeatureFlags = test.FF
						req.Spec.Initializer = &csapi.WorkspaceInitializer{
							Spec: &csapi.WorkspaceInitializer_Backup{
								Backup: &csapi.FromBackupInitializer{
									CheckoutLocation:   test.CheckoutLocation,
									FromVolumeSnapshot: false,
								},
							},
						}
						req.Spec.WorkspaceLocation = test.CheckoutLocation
						return nil
					}))
					if err != nil {
						t.Fatalf("cannot launch a workspace: %q", err)
					}

					t.Cleanup(func() {
						// stop workspace in defer function to prevent we forget to stop the workspace
						if err := stopWorkspace(t, cfg, stopWs1); err != nil {
							t.Errorf("cannot stop workspace: %q", err)
						}
					})

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
			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}

// TestOpenWorkspaceFromOutdatedPrebuild
// - create a prebuild on older commit
// - open a workspace from a later commit with a prebuild initializer
// - make sure the workspace's init task ran (the init task will create a file `incremental.txt` see https://github.com/gitpod-io/test-incremental-workspace/blob/main/.gitpod.yml)
func TestOpenWorkspaceFromOutdatedPrebuild(t *testing.T) {

	f := features.New("prebuild").
		WithLabel("component", "ws-manager").
		Assess("it should open a workspace from with an older prebuild initializer successfully and run the init task", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			tests := []struct {
				Name                    string
				RemoteUri               string
				CloneTargetForPrebuild  string
				CloneTargetForWorkspace string
				WorkspaceRoot           string
				CheckoutLocation        string
				FF                      []wsmanapi.WorkspaceFeatureFlag
			}{
				{
					Name:                    "classic",
					RemoteUri:               "https://github.com/gitpod-io/test-incremental-workspace",
					CloneTargetForPrebuild:  "prebuild",
					CloneTargetForWorkspace: "main",
					CheckoutLocation:        "test-incremental-workspace",
					WorkspaceRoot:           "/workspace/test-incremental-workspace",
				},
			}

			for _, test := range tests {
				test := test
				t.Run(test.Name, func(t *testing.T) {
					t.Parallel()

					ctx, cancel := context.WithTimeout(testCtx, time.Duration(10*len(tests))*time.Minute)
					defer cancel()

					api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
					t.Cleanup(func() {
						api.Done(t)
					})

					// create a prebuild
					ws, prebuildStopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api,
						integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
							req.Type = wsmanapi.WorkspaceType_PREBUILD
							req.Spec.Envvars = append(req.Spec.Envvars, &wsmanapi.EnvironmentVariable{
								Name:  "GITPOD_TASKS",
								Value: `[{ "init": "./init.sh" }]`,
							})
							req.Spec.FeatureFlags = test.FF
							req.Spec.Initializer = &csapi.WorkspaceInitializer{
								Spec: &csapi.WorkspaceInitializer_Git{
									Git: &csapi.GitInitializer{
										RemoteUri:        test.RemoteUri,
										TargetMode:       csapi.CloneTargetMode_REMOTE_BRANCH,
										CloneTaget:       test.CloneTargetForPrebuild,
										CheckoutLocation: test.CheckoutLocation,
										Config:           &csapi.GitConfig{},
									},
								},
							}
							req.Spec.WorkspaceLocation = test.CheckoutLocation
							return nil
						}),
						// The init task only runs for a short duration, so it's possible we miss the Running state, as it quickly transitions to Stopping/Stopped.
						// Therefore wait for the workspace to stop to get its last status.
						integration.WithWaitWorkspaceForOpts(integration.WaitForStopped))
					if err != nil {
						t.Fatalf("cannot launch a workspace: %q", err)
					}
					defer func() {
						// stop workspace in defer function to prevent we forget to stop the workspace
						if err := stopWorkspace(t, cfg, prebuildStopWs); err != nil {
							t.Errorf("cannot stop workspace: %q", err)
						}
					}()
					prebuildSnapshot, _, err := findSnapshotFromStoppedWs(t, ctx, ws.LastStatus)
					if err != nil {
						t.Fatalf("stop workspace and find snapshot error: %v", err)
					}
					if prebuildSnapshot == "" {
						t.Fatalf("prebuild snapshot is empty")
					}

					t.Logf("prebuild snapshot: %s", prebuildSnapshot)

					// launch the workspace on a later commit using this prebuild
					ws, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
						req.Spec.Envvars = append(req.Spec.Envvars, &wsmanapi.EnvironmentVariable{
							Name:  "GITPOD_TASKS",
							Value: `[{ "init": "./init.sh" }]`,
						})
						req.Spec.FeatureFlags = test.FF
						req.Spec.Initializer = &csapi.WorkspaceInitializer{
							Spec: &csapi.WorkspaceInitializer_Prebuild{
								Prebuild: &csapi.PrebuildInitializer{
									Prebuild: &csapi.SnapshotInitializer{
										Snapshot: prebuildSnapshot,
									},
									Git: []*csapi.GitInitializer{
										{
											RemoteUri:        test.RemoteUri,
											TargetMode:       csapi.CloneTargetMode_REMOTE_BRANCH,
											CloneTaget:       test.CloneTargetForWorkspace,
											CheckoutLocation: test.CheckoutLocation,
											Config:           &csapi.GitConfig{},
										},
									},
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
						t.Logf("file: %s", f)
						if filepath.Base(f) == "incremental.txt" {
							found = true
						}
					}
					if !found {
						t.Fatal("did not find incremental.txt")
					}
				})
			}
			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}

// checkPrebuildLogExist checks the prebuild log message exists
func checkPrebuildLogExist(t *testing.T, cfg *envconf.Config, rsa *integration.RpcClient, ws *integration.LaunchWorkspaceDirectlyResult, wsRoot string) {
	// since the message '🍊 This task ran as a workspace prebuild' is generated by
	// a prebuild workspace supervisor, so we add a retry mechanism to make sure that we
	// won't check the message too earlier before the supervisor generated it.
	var (
		err              error
		grepResp         agent.ExecResponse
		checkPrebuildLog bool
	)
	err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     prebuildLogPath,
		Command: "bash",
		Args: []string{
			"-c",
			fmt.Sprintf("grep %s *", prebuildLog),
		},
	}, &grepResp)
	if err == nil && grepResp.ExitCode == 0 && strings.Trim(grepResp.Stdout, " \t\n") != "" {
		checkPrebuildLog = true
	}
	if checkPrebuildLog {
		return
	}

	t.Logf("cannot found the prebuild message %s in %s, err:%v, exitCode:%d, stdout:%s", prebuildLog, prebuildLogPath, err, grepResp.ExitCode, grepResp.Stdout)

	// somehow, the prebuild log message '🍊 This task ran as a workspace prebuild' does not exists
	// we fall back to check the init task message within the /workspace/.gitpod/prebuild-log-* or not
	var grepResp1 agent.ExecResponse
	var checkInitTaskMsg bool
	err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     prebuildLogPath,
		Command: "bash",
		Args: []string{
			"-c",
			fmt.Sprintf("grep %q *", initTask),
		},
	}, &grepResp1)
	if err == nil && grepResp1.ExitCode == 0 && strings.Trim(grepResp1.Stdout, " \t\n") != "" {
		checkInitTaskMsg = true
	}
	if checkInitTaskMsg {
		return
	}

	t.Logf("cannot found the init task message %s in %s, err:%v, exitCode:%d, stdout:%s", initTask, prebuildLogPath, err, grepResp.ExitCode, grepResp.Stdout)

	// somehow, the init task message does not exist within the /workspace/.gitpod/prebuild-log-*
	// we fall back to check the file exists or not
	var ls agent.ListDirResponse
	err = rsa.Call("WorkspaceAgent.ListDir", &agent.ListDirRequest{
		Dir: wsRoot,
	}, &ls)
	if err != nil {
		t.Fatal(err)
	}

	var found bool
	for _, f := range ls.Files {
		if filepath.Base(f) == "someFile" {
			found = true
			break
		}
	}
	if found {
		return
	}
	t.Fatal("did not find someFile from previous workspace instance")
}

// checkFolderPermission checks the folder UID and GID is gitpod
func checkFolderPermission(t *testing.T, rsa *integration.RpcClient, workspace string) {
	var uid agent.ExecResponse
	err := rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Command: "stat",
		Args:    []string{"--format", "%U", workspace},
	}, &uid)
	if err != nil || uid.ExitCode != 0 || strings.Trim(uid.Stdout, " \t\n") != "gitpod" {
		t.Fatalf("folder %s UID %s is incorrect, err:%v, exitCode:%d", workspace, uid.Stdout, err, uid.ExitCode)
	}

	var gid agent.ExecResponse
	err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Command: "stat",
		Args:    []string{"--format", "%G", workspace},
	}, &gid)
	if err != nil || uid.ExitCode != 0 || strings.Trim(gid.Stdout, " \t\n") != "gitpod" {
		t.Fatalf("folder %s GID %s is incorrect, err:%v, exitCode:%d", workspace, gid.Stdout, err, uid.ExitCode)
	}
}

// checkGitFolderPermission checks the files/folders UID and GID under .git/ is gitpod
func checkGitFolderPermission(t *testing.T, rsa *integration.RpcClient, workspaceRoot string) {
	var findUserResp agent.ExecResponse
	var gitDir string = fmt.Sprintf("%s/%s", workspaceRoot, ".git")

	err := rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     gitDir,
		Command: "find",
		Args:    []string{"!", "-user", "gitpod"},
	}, &findUserResp)
	if err != nil || findUserResp.ExitCode != 0 || strings.Trim(findUserResp.Stdout, " \t\n") != "" {
		t.Fatalf("incorrect UID under %s folder, err:%v, exitCode:%d, stdout:%s", gitDir, err, findUserResp.ExitCode, findUserResp.Stdout)
	}

	var findGroupResp agent.ExecResponse
	err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     gitDir,
		Command: "find",
		Args:    []string{"!", "-group", "gitpod"},
	}, &findGroupResp)
	if err != nil || findGroupResp.ExitCode != 0 || strings.Trim(findGroupResp.Stdout, " \t\n") != "" {
		t.Fatalf("incorrect GID under %s folder, err:%v, exitCode:%d, stdout:%s", gitDir, err, findGroupResp.ExitCode, findGroupResp.Stdout)
	}
}

func checkPrebuildLogUploaded(t *testing.T, ctx context.Context, api *integration.ComponentAPI, ws *integration.LaunchWorkspaceDirectlyResult) {
	cs, err := api.ContentService()
	if err != nil {
		t.Fatal(err)
	}
	resp, err := cs.ListLogs(ctx, &csapi.ListLogsRequest{
		WorkspaceId: ws.LastStatus.Metadata.MetaId,
		InstanceId:  ws.Req.Id,
		OwnerId:     ws.LastStatus.Metadata.Owner,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.TaskId) == 0 {
		t.Fatal("no logs found")
	}
	t.Logf("found logs (task ids: %v)", resp.TaskId)
}

func findSnapshotFromStoppedWs(t *testing.T, ctx context.Context, lastStatus *wsmanapi.WorkspaceStatus) (string, *wsmanapi.VolumeSnapshotInfo, error) {
	if lastStatus == nil {
		return "", nil, fmt.Errorf("did not get last workspace status")
	}
	if lastStatus.Phase != wsmanapi.WorkspacePhase_STOPPED {
		return "", nil, fmt.Errorf("workspace is not stopped: %s", lastStatus.Phase)
	}
	if lastStatus.Conditions == nil {
		return "", nil, nil
	}
	if lastStatus.Conditions.HeadlessTaskFailed != "" {
		return "", nil, errors.New("unexpected HeadlessTaskFailed condition")
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
