// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"
)

func TestProcessLimit(t *testing.T) {
	f := features.New("process limit").
		WithLabel("component", "workspace").
		WithLabel("type", "process limit").
		Assess("it has a proc limit", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
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
					t.Errorf("cannot stop workspace: %v", err)
				}
			})

			rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(), integration.WithInstanceID(nfo.Req.Id))
			integration.DeferCloser(t, closer)
			if err != nil {
				t.Fatalf("unexpected error instrumenting workspace: %v", err)
			}
			defer rsa.Close()

			// Sometimes the workspace stops once we run out of processes (supervisor will exit with a failure),
			// so also start watching for the workspace to stop and observe its exit status.
			ready := make(chan struct{}, 1)
			stopStatus := make(chan *wsmanapi.WorkspaceStatus, 1)
			go func() {
				status, err := integration.WaitForWorkspaceStop(t, ctx, ready, api, nfo.Req.Id, nfo.WorkspaceID, integration.WorkspaceCanFail)
				if err != nil {
					if !errors.Is(err, context.Canceled) {
						// If context got canceled, we're just shutting down the test
						// and the workspace didn't exit due to reaching the process limit.
						t.Errorf("error waiting for workspace stop: %v", err)
					}
					stopStatus <- nil
					return
				}

				t.Logf("workspace stopped: %v", stopStatus)
				stopStatus <- status
			}()

			t.Logf("creating processes")
			var res agent.ExecResponse
			err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
				Dir:     "/workspace",
				Command: "bash",
				Args:    []string{"-c", "timeout 20s bash -c 'while true; do sleep 20 && date & done'"},
			}, &res)
			if err != nil {
				t.Logf("exec failed, most likely the workspace failed due to the process limit, so check for workspace failure status instead. Exec err: %v", err)
				select {
				case <-ctx.Done():
					t.Fatalf("expected workspace to stop, but it didn't")
				case s := <-stopStatus:
					if s == nil {
						t.Fatalf("there was an error getting the workspace stop status")
					}

					if s.Conditions == nil || s.Conditions.Failed == "" {
						t.Fatalf("expected workspace to fail, but it didn't: %v", s)
					}
					t.Logf("workspace stopped and failed (as expected): %v", s)
				}
				return testCtx
			}

			t.Logf("checking output for fork errors due to process limiting")
			if !strings.Contains(res.Stdout, "bash: fork: retry: Resource temporarily unavailable") {
				t.Errorf("expected fork error (Resource temporarily unavailable), but got none (%d): %s", res.ExitCode, res.Stdout)
			}

			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}
