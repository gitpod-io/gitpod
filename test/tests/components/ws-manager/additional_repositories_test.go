// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

func TestAdditionalRepositories(t *testing.T) {
	f := features.New("additional-repositories").
		WithLabel("component", "ws-manager").
		Assess("can open a workspace using the additionalRepositories property", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			tests := []struct {
				Name       string
				ContextURL string
				CloneTaget string
			}{
				{
					Name:       "workspace with additionalRepositories using a branch",
					ContextURL: "https://github.com/gitpod-io/gitpod-test-repo",
					CloneTaget: "aledbf/test-additional-repositories",
				},
				{
					Name:       "workspace with additionalRepositories also using a branch in one of the additionalRepositories",
					ContextURL: "https://github.com/gitpod-io/gitpod-test-repo",
					CloneTaget: "aledbf/test-additional-repositories-with-branches",
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

					testRepoName := "gitpod-test-repo"
					ws, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(func(req *wsmanapi.StartWorkspaceRequest) error {
						req.Spec.WorkspaceLocation = testRepoName
						req.Spec.Initializer = &csapi.WorkspaceInitializer{
							Spec: &csapi.WorkspaceInitializer_Git{
								Git: &csapi.GitInitializer{
									RemoteUri:        test.ContextURL,
									CloneTaget:       test.CloneTaget,
									Config:           &csapi.GitConfig{},
									TargetMode:       csapi.CloneTargetMode_REMOTE_BRANCH,
									CheckoutLocation: testRepoName,
								},
							},
						}

						return nil
					}))
					if err != nil {
						t.Fatal(err)
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

					integration.DeferCloser(t, closer)
					defer rsa.Close()

					var gitOut agent.ExecResponse
					err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
						Dir:     fmt.Sprintf("/workspace/%v", testRepoName),
						Command: "bash",
						Args: []string{
							"-c",
							"git symbolic-ref --short HEAD",
						},
					}, &gitOut)
					if err != nil {
						t.Fatal(err)
					}

					out := strings.TrimSpace(gitOut.Stdout)
					if test.CloneTaget != out {
						t.Errorf("returned branch %v is not %v", out, test.CloneTaget)
					}
				})
			}

			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}
