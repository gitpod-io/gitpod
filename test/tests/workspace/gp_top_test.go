// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"
)

func TestGpTop(t *testing.T) {
	f := features.New("gp top").
		WithLabel("component", "workspace").
		WithLabel("type", "gp top").
		Assess("it can run gp top and retrieve cpu/memory usage", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			t.Parallel()

			ctx, cancel := context.WithTimeout(testCtx, time.Duration(10*time.Minute))
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

			t.Logf("running gp top")
			var res agent.ExecResponse
			err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
				Dir:     "/workspace",
				Command: "gp",
				Env:     []string{"SUPERVISOR_ADDR=10.0.5.2:22999"},
				Args:    []string{"top", "--json"},
			}, &res)
			if err != nil {
				t.Fatal(err)
			}
			if res.ExitCode != 0 {
				t.Fatalf("gp top failed (%d): %s", res.ExitCode, res.Stderr)
			}

			t.Logf("gp top: %s", res.Stdout)

			type gpTop struct {
				Resources struct {
					CPU struct {
						Used  int `json:"used"`
						Limit int `json:"limit"`
					} `json:"cpu"`
					Memory struct {
						Used  int `json:"used"`
						Limit int `json:"limit"`
					} `json:"memory"`
				} `json:"resources"`
			}
			var top gpTop
			err = json.Unmarshal([]byte(res.Stdout), &top)
			if err != nil {
				t.Fatalf("cannot unmarshal gp top output: %v", err)
			}

			t.Logf("verifying gp top output is not empty")
			if top.Resources.CPU.Used == 0 {
				t.Errorf("gp top reports 0 CPU usage")
			}
			if top.Resources.Memory.Used == 0 {
				t.Errorf("gp top reports 0 memory usage")
			}
			if top.Resources.CPU.Limit == 0 {
				t.Errorf("gp top reports 0 CPU limit")
			}
			if top.Resources.Memory.Limit == 0 {
				t.Errorf("gp top reports 0 memory limit")
			}

			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}
