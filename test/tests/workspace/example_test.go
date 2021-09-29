// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

func TestWorkspaceInstrumentation(t *testing.T) {
	f := features.New("instrumentation").
		WithLabel("component", "server").
		Assess("it can instrument a workspace", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			nfo, stopWs, err := integration.LaunchWorkspaceFromContextURL(ctx, "github.com/gitpod-io/gitpod", username, api)
			if err != nil {
				t.Fatal(err)
			}
			defer stopWs(true)

			rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), cfg.Client(), integration.WithInstanceID(nfo.LatestInstance.ID))
			if err != nil {
				t.Fatal(err)
			}
			defer rsa.Close()
			integration.DeferCloser(t, closer)

			var ls agent.ListDirResponse
			err = rsa.Call("WorkspaceAgent.ListDir", &agent.ListDirRequest{
				Dir: "/workspace/gitpod",
			}, &ls)
			if err != nil {
				t.Fatal(err)
			}
			for _, f := range ls.Files {
				t.Log(f)
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}

func TestLaunchWorkspaceDirectly(t *testing.T) {
	f := features.New("workspace").
		WithLabel("component", "server").
		Assess("it can run workspace tasks", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			nfo, err := integration.LaunchWorkspaceDirectly(ctx, api)
			if err != nil {
				t.Fatal(err)
			}

			err = integration.DeleteWorkspace(ctx, api, nfo.Req.Id)
			if err != nil {
				t.Fatal(err)
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
