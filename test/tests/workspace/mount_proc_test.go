// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

const (
	numberOfMount = 500
	parallel      = 5
)

func loadMountProc(t *testing.T, rsa *integration.RpcClient) {
	var resp agent.ExecResponse
	err := rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     "/",
		Command: "bash",
		Args: []string{
			"-c",
			fmt.Sprintf("for i in {1..%d}; do echo $i; sudo unshare -m --propagation unchanged mount -t proc proc $(mktemp -d) || exit 1; done", numberOfMount),
		},
	}, &resp)
	if err != nil {
		t.Fatalf("proc mount run failed: %v\n%s\n%s", err, resp.Stdout, resp.Stderr)
	}

	if resp.ExitCode != 0 {
		t.Fatalf("proc mount run failed: %s\n%s", resp.Stdout, resp.Stderr)
	}

}

func TestMountProc(t *testing.T) {
	f := features.New("proc mount").
		WithLabel("component", "workspace").
		Assess("load test proc mount", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 5*time.Minute)
			defer cancel()

			t.Parallel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			ws, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api)
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

			rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(), integration.WithInstanceID(ws.Req.Id), integration.WithWorkspacekitLift(true))
			if err != nil {
				t.Fatalf("unexpected error instrumenting workspace: %v", err)
			}
			defer rsa.Close()
			integration.DeferCloser(t, closer)

			var wg sync.WaitGroup
			wg.Add(parallel)
			for i := 0; i < parallel; i++ {
				go func() {
					defer wg.Done()
					loadMountProc(t, rsa)
				}()
			}
			wg.Wait()

			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}
