// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"fmt"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"github.com/gitpod-io/gitpod/test/pkg/report"
)

const (
	K3S_VERSION = "1.23.4"
	TIME_OUT    = 10 * time.Minute
)

func TestK3s(t *testing.T) {
	f := features.New("k3s").
		WithLabel("component", "workspace").
		Assess("it should start a k3s when cgroup v2 enable", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			report.SetupReport(t, report.FeatureGit, "test to verify that k3s is able to run on the workspace")
			t.Parallel()

			ctx, cancel := context.WithTimeout(context.Background(), TIME_OUT)
			defer cancel()

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
					t.Fatal(err)
				}
			})

			rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(), integration.WithInstanceID(ws.Req.Id), integration.WithWorkspacekitLift(true))
			if err != nil {
				t.Fatalf("unexpected error instrumenting workspace: %v", err)
			}
			defer rsa.Close()
			integration.DeferCloser(t, closer)

			cgv2, err := integration.IsCgroupV2(rsa)
			if err != nil {
				t.Fatalf("unexpected error checking cgroup v2: %v", err)
			}

			if !cgv2 {
				t.Skip("This test only works for cgroup v2")
			}

			go func() {
				var respReadyForK3s agent.ExecResponse
				k3sUrl := fmt.Sprintf("https://github.com/k3s-io/k3s/releases/download/v%s%%2Bk3s1/k3s", K3S_VERSION)
				err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
					Dir:     "/",
					Command: "bash",
					Args: []string{
						"-c",
						fmt.Sprintf("curl -L %s -o /workspace/k3s && sudo chmod +x /workspace/k3s && sudo /workspace/k3s server -d /workspace/data --flannel-backend=host-gw > /dev/null 2>&1", k3sUrl),
					},
				}, &respReadyForK3s)
			}()

			kubeEnv := []string{
				"KUBECONFIG=/etc/rancher/k3s/k3s.yaml",
			}
			var respWaitForK3s agent.ExecResponse
			timeout := fmt.Sprintf("%.0fm", TIME_OUT.Minutes())
			err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
				Dir:     "/",
				Command: "bash",
				Env:     kubeEnv,
				Args: []string{
					"-c",
					fmt.Sprintf("timeout %s bash -c 'while [ ! -e /etc/rancher/k3s/k3s.yaml ]; do sleep 1; done' && sudo chmod +r /etc/rancher/k3s/k3s.yaml && timeout %s bash -c 'until /workspace/k3s kubectl wait --for=condition=Ready nodes -l node-role.kubernetes.io/master=true --timeout %s; do sleep 1; done'", timeout, timeout, timeout),
				},
			}, &respWaitForK3s)
			if err != nil {
				t.Fatalf("failed to wait for starting k3s: %v\n%s\n%s", err, respWaitForK3s.Stdout, respWaitForK3s.Stderr)
			}

			if respWaitForK3s.ExitCode != 0 {
				t.Fatalf("failed to wait for starting k3s: %s\n%s", respWaitForK3s.Stdout, respWaitForK3s.Stderr)
			}

			var respGetPods agent.ExecResponse
			err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
				Dir:     "/",
				Command: "bash",
				Env:     kubeEnv,
				Args: []string{
					"-c",
					"/workspace/k3s kubectl get nodes",
				},
			}, &respGetPods)
			if err != nil {
				t.Fatalf("failed to get nodes: %v\n%s\n%s", err, respGetPods.Stdout, respGetPods.Stderr)
			}

			if respGetPods.ExitCode != 0 {
				t.Fatalf("failed to get nodes: %s\n%s", respGetPods.Stdout, respGetPods.Stderr)
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
