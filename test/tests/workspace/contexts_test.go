// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

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
	"github.com/gitpod-io/gitpod/test/pkg/integration/common"
)

type ContextTest struct {
	Skip               bool
	Name               string
	ContextURL         string
	WorkspaceRoot      string
	ExpectedBranch     string
	ExpectedBranchFunc func(username string) string
}

func TestGitHubContexts(t *testing.T) {
	tests := []ContextTest{
		{
			Name:           "open repository",
			ContextURL:     "github.com/gitpod-io/gitpod",
			WorkspaceRoot:  "/workspace/gitpod",
			ExpectedBranch: "main",
		},
		{
			Name:           "open branch",
			ContextURL:     "github.com/gitpod-io/gitpod-test-repo/tree/integration-test-1",
			WorkspaceRoot:  "/workspace/gitpod-test-repo",
			ExpectedBranch: "integration-test-1",
		},
		{
			Name:          "open issue",
			ContextURL:    "github.com/gitpod-io/gitpod-test-repo/issues/88",
			WorkspaceRoot: "/workspace/gitpod-test-repo",
			ExpectedBranchFunc: func(username string) string {
				return fmt.Sprintf("%s/integration-88", username)
			},
		},
		{
			Name:           "open tag",
			ContextURL:     "github.com/gitpod-io/gitpod-test-repo/tree/integration-test-context-tag",
			WorkspaceRoot:  "/workspace/gitpod-test-repo",
			ExpectedBranch: "HEAD",
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
			ExpectedBranchFunc: func(username string) string {
				return fmt.Sprintf("%s/write-a-readme-1", username)
			},
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
		Assess("should run context tests", func(ctx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 60*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			ffs := []struct {
				Name string
				FF   string
			}{
				{Name: "classic"},
				{Name: "pvc", FF: "persistent_volume_claim"},
			}

			for _, ff := range ffs {
				for _, test := range tests {
					t.Run(test.ContextURL+"_"+ff.Name, func(t *testing.T) {
						if test.Skip {
							t.SkipNow()
						}

						username := username + ff.Name
						userId, err := api.CreateUser(username, userToken)
						if err != nil {
							t.Fatal(err)
						}

						if err := api.UpdateUserFeatureFlag(userId, ff.FF); err != nil {
							t.Fatal(err)
						}

						nfo, stopWS, err := integration.LaunchWorkspaceFromContextURL(ctx, test.ContextURL, username, api)
						if err != nil {
							t.Fatal(err)
						}
						t.Cleanup(func() {
							stopWS(true)
						})

						rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(), integration.WithInstanceID(nfo.LatestInstance.ID))
						if err != nil {
							t.Fatal(err)
						}
						defer rsa.Close()
						integration.DeferCloser(t, closer)

						// get actual from workspace
						git := common.Git(rsa)
						err = git.ConfigSafeDirectory()
						if err != nil {
							t.Fatal(err)
						}
						actBranch, err := git.GetBranch(test.WorkspaceRoot)
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
			}
			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
