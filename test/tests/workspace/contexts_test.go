// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace_test

import (
	"context"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"github.com/gitpod-io/gitpod/test/tests/workspace/common"
)

type ContextTest struct {
	Skip           bool
	Name           string
	ContextURL     string
	WorkspaceRoot  string
	ExpectedBranch string
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
			Skip:           true, // user-dependant result not supported atm
			Name:           "open issue",
			ContextURL:     "github.com/gitpod-io/gitpod-test-repo/issues/88",
			WorkspaceRoot:  "/workspace/gitpod-test-repo",
			ExpectedBranch: "geropl/integration-tests-test-context-88",
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
			Skip:           true, // user-dependant result not supported atm
			Name:           "open issue",
			ContextURL:     "gitlab.com/AlexTugarev/gp-test/issues/1",
			WorkspaceRoot:  "/workspace/gp-test",
			ExpectedBranch: "geropl/write-a-readme-1",
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
	for _, test := range tests {
		t.Run(test.ContextURL, func(t *testing.T) {
			if test.Skip {
				t.SkipNow()
			}
			// TODO(geropl) Why does this not work? Logs hint to a race around bucket creation...?
			// t.Parallel()

			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			it := integration.NewTest(t)
			defer it.Done()

			nfo, stopWS := integration.LaunchWorkspaceFromContextURL(it, ctx, test.ContextURL)
			defer stopWS(false) // we do not wait for stopped here as it does not matter for this test case and speeds things up

			wctx, wcancel := context.WithTimeout(ctx, 1*time.Minute)
			defer wcancel()
			it.WaitForWorkspace(wctx, nfo.LatestInstance.ID)

			rsa, err := it.Instrument(integration.ComponentWorkspace, "workspace", integration.WithInstanceID(nfo.LatestInstance.ID))
			if err != nil {
				t.Fatal(err)
			}
			defer rsa.Close()

			// get actual from workspace
			git := common.Git(rsa)
			actBranch, err := git.GetBranch(test.WorkspaceRoot)
			if err != nil {
				t.Fatal(err)
			}
			rsa.Close()

			if actBranch != test.ExpectedBranch {
				t.Fatalf("expected branch '%s', got '%s'!", test.ExpectedBranch, actBranch)
			}
		})
	}
}
