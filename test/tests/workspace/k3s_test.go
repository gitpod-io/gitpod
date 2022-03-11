// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
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
	"github.com/gitpod-io/gitpod/test/tests/workspace/common"
)

func TestK3s(t *testing.T) {
	f := features.New("k3s").
		WithLabel("component", "workspace").
		Assess("it should start a k3s when cgroup v2 enable", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			ws, err := integration.LaunchWorkspaceDirectly(ctx, api)
			if err != nil {
				t.Fatal(err)
			}
			defer func() {
				err = integration.DeleteWorkspace(ctx, api, ws.Req.Id)
				if err != nil {
					t.Fatal(err)
				}
			}()

			rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(), integration.WithInstanceID(ws.Req.Id), integration.WithWorkspacekitLift(true))
			if err != nil {
				t.Fatalf("unexpected error instrumenting workspace: %v", err)
			}
			defer rsa.Close()
			integration.DeferCloser(t, closer)

			cgv2, err := common.IsCgroupV2(rsa)
			if err != nil {
				t.Fatalf("unexpected error checking cgroup v2: %v", err)
			}

			if !cgv2 {
				t.Skip("This test only works for cgroup v2")
			}

			go func() {
				var respReadyForK3s agent.ExecResponse
				err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
					Dir:     "/",
					Command: "bash",
					Args: []string{
						"-c",
						"curl -L https://github.com/k3s-io/k3s/releases/download/v1.23.4%2Bk3s1/k3s -o /workspace/k3s && sudo chmod +x /workspace/k3s && sudo /workspace/k3s server -d /workspace/data --flannel-backend=host-gw > /dev/null 2>&1",
					},
				}, &respReadyForK3s)
			}()

			kubeEnv := []string{
				"KUBECONFIG=/etc/rancher/k3s/k3s.yaml",
			}
			var respWaitForK3s agent.ExecResponse
			err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
				Dir:     "/",
				Command: "bash",
				Env:     kubeEnv,
				Args: []string{
					"-c",
					"timeout 30s bash -c 'while [ ! -e /etc/rancher/k3s/k3s.yaml ]; do sleep 1; done' && sudo chmod +r /etc/rancher/k3s/k3s.yaml && timeout 1m bash -c 'until /workspace/k3s kubectl wait --for=condition=Ready nodes -l node-role.kubernetes.io/master=true --timeout 30s; do sleep 1; done'",
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
