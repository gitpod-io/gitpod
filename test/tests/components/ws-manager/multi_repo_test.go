// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"path/filepath"
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

var repos = []struct {
	RemoteUri        string
	CloneTarget      string
	ExpectedBranch   string
	CheckoutLocation string
}{
	{
		RemoteUri:        "https://github.com/gitpod-io/gitpod",
		CloneTarget:      "main",
		ExpectedBranch:   "main",
		CheckoutLocation: "gitpod",
	},
	{
		RemoteUri:        "https://github.com/gitpod-io/gitpod",
		CloneTarget:      "master",
		ExpectedBranch:   "main",
		CheckoutLocation: "gitpod",
	},
	{
		RemoteUri:        "https://github.com/gitpod-io/workspace-images",
		CloneTarget:      "main",
		ExpectedBranch:   "main",
		CheckoutLocation: "workspace-images",
	},
	{
		RemoteUri:        "https://github.com/gitpod-io/dazzle",
		CloneTarget:      "main",
		ExpectedBranch:   "main",
		CheckoutLocation: "dazzle",
	},
	{
		RemoteUri:        "https://github.com/gitpod-io/leeway",
		CloneTarget:      "main",
		ExpectedBranch:   "main",
		CheckoutLocation: "leeway",
	},
	{
		RemoteUri:        "https://github.com/gitpod-io/ws-manager-integration-test",
		CloneTarget:      "master", // default branch is main
		ExpectedBranch:   "master",
		CheckoutLocation: "ws-manager-integration-test",
	},
}

func TestMultiRepoWorkspaceSuccess(t *testing.T) {
	f := features.New("multi-repo").WithLabel("component", "ws-manager").Assess("can create multi repo workspace", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
		t.Parallel()

		ctx, cancel := context.WithTimeout(testCtx, 5*time.Minute)
		defer cancel()

		api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
		t.Cleanup(func() {
			api.Done(t)
		})

		multiRepoInit := func(swr *wsmanapi.StartWorkspaceRequest) error {
			composite := &csapi.CompositeInitializer{}
			initializers := []*csapi.WorkspaceInitializer{}

			for _, repo := range repos {
				init := &csapi.WorkspaceInitializer{
					Spec: &csapi.WorkspaceInitializer_Git{
						Git: &csapi.GitInitializer{
							RemoteUri:        repo.RemoteUri,
							TargetMode:       csapi.CloneTargetMode_REMOTE_BRANCH,
							CloneTaget:       repo.CloneTarget,
							CheckoutLocation: repo.CheckoutLocation,
							Config:           &csapi.GitConfig{},
						},
					},
				}

				initializers = append(initializers, init)
			}

			composite.Initializer = initializers
			swr.Spec.Initializer = &csapi.WorkspaceInitializer{
				Spec: &csapi.WorkspaceInitializer_Composite{
					Composite: &csapi.CompositeInitializer{
						Initializer: initializers,
					},
				},
			}
			swr.Spec.WorkspaceLocation = "gitpod"
			return nil
		}

		ws, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(multiRepoInit))
		if err != nil {
			t.Fatal(err)
		}

		t.Cleanup(func() {
			sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer scancel()

			sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
			defer sapi.Done(t)

			_, err = stopWs(true, sapi)
			if err != nil {
				t.Errorf("cannot stop workspace: %q", err)
			}
		})

		rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(),
			integration.WithInstanceID(ws.Req.Id),
			integration.WithContainer("workspace"),
			integration.WithWorkspacekitLift(true),
		)
		if err != nil {
			t.Fatal(err)
		}

		integration.DeferCloser(t, closer)
		defer rsa.Close()

		assertRepositories(t, rsa)

		return testCtx
	}).Feature()

	testEnv.Test(t, f)
}

func assertRepositories(t *testing.T, rsa *integration.RpcClient) {
	var ls agent.ListDirResponse
	err := rsa.Call("WorkspaceAgent.ListDir", &agent.ListDirRequest{
		Dir: "/workspace",
	}, &ls)

	if err != nil {
		t.Fatal(err)
	}

	expected := make(map[string]*struct {
		Cloned bool
		Branch string
	})
	for _, r := range repos {
		expected[r.CheckoutLocation] = &struct {
			Cloned bool
			Branch string
		}{
			Cloned: false,
			Branch: r.ExpectedBranch,
		}
	}

	for _, dir := range ls.Files {
		if strings.HasPrefix(dir, ".") {
			continue
		}
		if _, ok := expected[dir]; ok {
			expected[dir].Cloned = true
		} else {
			t.Fatalf("unexpected repository %s", dir)
		}
	}

	git := integration.Git(rsa)

	for k, v := range expected {
		if !v.Cloned {
			t.Fatalf("repository %s has not been cloned", k)
		}

		branch, err := git.GetBranch(filepath.Join("/workspace", k), false)
		if err != nil {
			t.Fatal(err)
		}

		if branch != v.Branch {
			t.Fatalf("expected branch %s, but got %s", v.Branch, branch)
		}
	}
}
