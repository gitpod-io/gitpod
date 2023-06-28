// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"testing"
	"time"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"
)

func TestEphemeralStorageLimit(t *testing.T) {
	f := features.New("ephemeral storage limit").
		WithLabel("component", "workspace").
		WithLabel("type", "ephemeral storage limit").
		Assess("it should stop a workspace that reaches the ephemeral storage limit", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			t.Parallel()

			ctx, cancel := context.WithTimeout(testCtx, time.Duration(5*time.Minute))
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			nfo, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api)
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

			t.Logf("allocating disk space")
			var res agent.ExecResponse
			err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
				Dir:     "/workspace",
				Command: "fallocate",
				Args:    []string{"-l", "11G", "/var/tmp/test1"},
			}, &res)
			if err != nil {
				t.Fatal(err)
			}
			if res.ExitCode != 0 {
				t.Fatalf("fallocate failed (%d): %s", res.ExitCode, res.Stderr)
			}

			t.Logf("expecting workspace to stop")
			ready := make(chan struct{}, 1)
			status, err := integration.WaitForWorkspaceStop(t, ctx, ready, api, nfo.Req.Id, nfo.WorkspaceID, integration.WorkspaceCanFail)
			if err != nil {
				t.Fatal(err)
			}

			t.Logf("workspace stopped: %v", status)

			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}
