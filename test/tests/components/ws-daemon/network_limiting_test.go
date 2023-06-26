// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsdaemon

import (
	"context"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/test/pkg/integration"
	corev1 "k8s.io/api/core/v1"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"
)

func TestNetworkdLimiting(t *testing.T) {
	f := features.New("network limiting").
		WithLabel("component", "ws-daemon").
		Assess("verify if network limiting works fine", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			t.Parallel()

			ctx, cancel := context.WithTimeout(testCtx, 5*time.Minute)
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

			daemonClient, daemonCloser, err := integration.Instrument(integration.ComponentWorkspaceDaemon, "daemon", cfg.Namespace(), kubeconfig, cfg.Client(),
				integration.WithWorkspacekitLift(false),
				integration.WithContainer("ws-daemon"))
			if err != nil {
				t.Fatalf("unexpected error instrumenting daemon: %v", err)
			}
			defer daemonClient.Close()
			integration.DeferCloser(t, daemonCloser)

			var pod corev1.Pod
			if err := cfg.Client().Resources().Get(ctx, "ws-"+ws.Req.Id, cfg.Namespace(), &pod); err != nil {
				t.Fatal(err)
			}

			// containerId := getWorkspaceContainerId(&pod)

			return testCtx
		}).Feature()

	testEnv.Test(t, f)
}
