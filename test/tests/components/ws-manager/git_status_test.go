// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"fmt"
	"testing"
	"time"

	"google.golang.org/protobuf/proto"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

// TestGitStatus tests that the git status is reported after a workspace is stopped.
func TestGitStatus(t *testing.T) {
	f := features.New("git-status").
		WithLabel("component", "ws-manager").
		Assess("it should report the git status of a workspace when it stops", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			tests := []struct {
				Name             string
				ContextURL       string
				WorkspaceRoot    string
				CheckoutLocation string
			}{
				{
					Name:             "classic",
					ContextURL:       "https://github.com/gitpod-io/empty",
					WorkspaceRoot:    "/workspace/empty",
					CheckoutLocation: "empty",
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

					// TODO: change to use server API to launch the workspace, so we could run the integration test as the user code flow
					//       which is client -> server -> ws-manager rather than client -> ws-manager directly
					ws1, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(func(w *wsmanapi.StartWorkspaceRequest) error {
						w.Spec.Initializer = &csapi.WorkspaceInitializer{
							Spec: &csapi.WorkspaceInitializer_Git{
								Git: &csapi.GitInitializer{
									RemoteUri:        test.ContextURL,
									CheckoutLocation: test.CheckoutLocation,
									Config:           &csapi.GitConfig{},
								},
							},
						}
						w.Spec.WorkspaceLocation = test.CheckoutLocation
						return nil
					}))
					if err != nil {
						t.Fatal(err)
					}
					t.Cleanup(func() {
						if err != nil {
							sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
							defer scancel()

							sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
							defer sapi.Done(t)

							_, err = stopWs(true, sapi)
							if err != nil {
								t.Fatal(err)
							}
						}
					})

					rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(),
						integration.WithInstanceID(ws1.Req.Id),
						integration.WithContainer("workspace"),
						integration.WithWorkspacekitLift(true),
					)
					if err != nil {
						t.Fatal(err)
					}
					integration.DeferCloser(t, closer)

					var resp agent.WriteFileResponse
					err = rsa.Call("WorkspaceAgent.WriteFile", &agent.WriteFileRequest{
						Path:    fmt.Sprintf("%s/foobar.txt", test.WorkspaceRoot),
						Content: []byte("hello world"),
						Mode:    0644,
					}, &resp)
					rsa.Close()
					if err != nil {
						if _, serr := stopWs(true, api); serr != nil {
							t.Errorf("cannot stop workspace: %q", serr)
						}
						t.Fatal(err)
					}

					lastStatus, err := stopWs(true, api)
					if err != nil {
						t.Fatal(err)
					}

					t.Logf("last status: %v", lastStatus)
					expected := &csapi.GitStatus{
						Branch:              "main",
						UntrackedFiles:      []string{"foobar.txt"},
						TotalUntrackedFiles: 1,
					}
					if !proto.Equal(lastStatus.Repo, expected) {
						t.Fatalf("unexpected git status: expected \"%+q\", got \"%+q\"", expected, lastStatus.Repo)
					}
				})
			}
			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)

}
