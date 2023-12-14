// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"github.com/gitpod-io/gitpod/test/pkg/report"
)

type ContextTest struct {
	Skip               bool
	Name               string
	ContextURL         string
	WorkspaceRoot      string
	ExpectedBranch     string
	ExpectedBranchFunc func(username string) string
	IgnoreError        bool
}

func TestGitHubContexts(t *testing.T) {
	tests := []ContextTest{
		{
			Name:           "open repository",
			ContextURL:     "github.com/gitpod-io/template-golang-cli",
			WorkspaceRoot:  "/workspace/template-golang-cli",
			ExpectedBranch: "main",
		},
		{
			Name:           "open branch",
			ContextURL:     "github.com/gitpod-io/gitpod-test-repo/tree/integration-test-1",
			WorkspaceRoot:  "/workspace/gitpod-test-repo",
			ExpectedBranch: "integration-test-1",
		},
		{
			// Branch name decisions are not tested in the workspace as it is the server side logic
			Name:          "open issue",
			ContextURL:    "github.com/gitpod-io/gitpod-test-repo/issues/88",
			WorkspaceRoot: "/workspace/gitpod-test-repo",
		},
		{
			Name:           "open tag",
			ContextURL:     "github.com/gitpod-io/gitpod-test-repo/tree/integration-test-context-tag",
			WorkspaceRoot:  "/workspace/gitpod-test-repo",
			ExpectedBranch: "HEAD",
		},
		{
			Name:           "Git LFS support",
			ContextURL:     "github.com/atduarte/lfs-test",
			WorkspaceRoot:  "/workspace/lfs-test",
			ExpectedBranch: "main",
		},
		{
			Name:           "empty repo",
			ContextURL:     "github.com/gitpod-io/empty",
			WorkspaceRoot:  "/workspace/empty",
			ExpectedBranch: "HEAD",
			IgnoreError:    true,
		},
	}
	runContextTests(t, tests)
}

func TestGitLabContexts(t *testing.T) {
	if !gitlab {
		t.Skip("Skipping gitlab integration tests")
	}
	tests := []ContextTest{
		{
			Name:           "open repository",
			ContextURL:     "gitlab.com/AlexTugarev/gp-test",
			WorkspaceRoot:  "/workspace/gp-test",
			ExpectedBranch: "master",
		},
		{
			Name:           "open branch",
			ContextURL:     "gitlab.com/AlexTugarev/gp-test/tree/wip",
			WorkspaceRoot:  "/workspace/gp-test",
			ExpectedBranch: "wip",
		},
		{
			Name:          "open issue",
			ContextURL:    "gitlab.com/AlexTugarev/gp-test/issues/1",
			WorkspaceRoot: "/workspace/gp-test",
		},
		{
			Name:           "open tag",
			ContextURL:     "gitlab.com/AlexTugarev/gp-test/merge_requests/2",
			WorkspaceRoot:  "/workspace/gp-test",
			ExpectedBranch: "wip2",
		},
	}
	runContextTests(t, tests)
}

func runContextTests(t *testing.T, tests []ContextTest) {
	userToken, _ := os.LookupEnv("USER_TOKEN")
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)

	f := features.New("context").
		WithLabel("component", "server").
		Assess("should run context tests", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {

			sctx, scancel := context.WithTimeout(testCtx, time.Duration(10*len(tests))*time.Minute)
			defer scancel()

			api := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
			defer api.Done(t)

			for _, test := range tests {
				test := test
				t.Run(test.ContextURL, func(t *testing.T) {
					report.SetupReport(t, report.FeatureContentInit, fmt.Sprintf("Test to open %v", test.ContextURL))
					if test.Skip {
						t.SkipNow()
					}

					t.Parallel()

					ctx, cancel := context.WithTimeout(context.Background(), time.Duration(5*len(tests))*time.Minute)
					defer cancel()

					api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
					defer api.Done(t)

					_, err := api.CreateUser(username, userToken)
					if err != nil {
						t.Fatal(err)
					}

					nfo, stopWs, err := integration.LaunchWorkspaceFromContextURL(t, ctx, test.ContextURL, username, api)
					if err != nil {
						t.Fatal(err)
					}

					t.Cleanup(func() {
						sctx, scancel := context.WithTimeout(context.Background(), 10*time.Minute)
						defer scancel()

						sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
						defer sapi.Done(t)

						_, err := stopWs(true, sapi)
						if err != nil {
							t.Fatal(err)
						}
					})

					rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(), integration.WithInstanceID(nfo.LatestInstance.ID))
					if err != nil {
						t.Fatal(err)
					}
					defer rsa.Close()
					integration.DeferCloser(t, closer)

					if test.ExpectedBranch == "" && test.ExpectedBranchFunc == nil {
						return
					}

					// get actual from workspace
					git := integration.Git(rsa)
					err = git.ConfigSafeDirectory()
					if err != nil {
						t.Fatal(err)
					}
					actBranch, err := git.GetBranch(test.WorkspaceRoot, test.IgnoreError)
					if err != nil {
						t.Fatal(err)
					}

					expectedBranch := test.ExpectedBranch
					if test.ExpectedBranchFunc != nil {
						expectedBranch = test.ExpectedBranchFunc(username)
					}
					if actBranch != expectedBranch {
						t.Fatalf("expected branch '%s', got '%s'!", expectedBranch, actBranch)
					}
				})
			}
			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}
