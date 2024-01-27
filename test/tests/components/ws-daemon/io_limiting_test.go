// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsdaemon

import (
	"context"
	"testing"
	"time"

	daemon "github.com/gitpod-io/gitpod/test/pkg/agent/daemon/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	corev1 "k8s.io/api/core/v1"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"
)

func TestIOLimiting(t *testing.T) {
	f := features.New("IO limiting").
		WithLabel("component", "ws-daemon").
		Assess("verify if io limiting works fine", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			t.Parallel()

			ctx, cancel := context.WithTimeout(testCtx, time.Duration(5*time.Minute))
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			daemonConfig := getDaemonConfig(ctx, t, cfg)
			if daemonConfig.IOLimitConfig.ReadBandwidthPerSecond.IsZero() {
				t.Fatal("io limiting ReadBandwidthPerSecond is not enabled")
			}
			if daemonConfig.IOLimitConfig.WriteBandwidthPerSecond.IsZero() {
				t.Fatal("io limiting WriteBandwidthPerSecond is not enabled")
			}

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

			daemonClient, daemonCloser, err := integration.Instrument(integration.ComponentWorkspaceDaemon, "daemon", cfg.Namespace(), kubeconfig, cfg.Client(),
				integration.WithWorkspacekitLift(false),
				integration.WithContainer("ws-daemon"),
			)

			if err != nil {
				t.Fatal(err)
			}
			integration.DeferCloser(t, daemonCloser)

			var pod corev1.Pod
			if err := cfg.Client().Resources().Get(ctx, "ws-"+nfo.Req.Id, cfg.Namespace(), &pod); err != nil {
				t.Fatal(err)
			}

			containerId := getWorkspaceContainerId(&pod)
			var resp daemon.GetWorkspaceResourcesResponse
			if err = daemonClient.Call("DaemonAgent.GetWorkspaceResources", daemon.GetWorkspaceResourcesRequest{
				ContainerId: containerId,
			}, &resp); err != nil {
				t.Fatalf("cannot get workspace resources: %q", err)
			}

			t.Logf("workspace resources: %+v", resp)
			if resp.FoundIOMax == false {
				t.Fatalf("cannot find io max")
			}
			if len(resp.IOMax) == 0 {
				t.Fatalf("cannot find workspace io max")
			}

			for _, ioMax := range resp.IOMax {
				if ioMax.Read != uint64(daemonConfig.IOLimitConfig.ReadBandwidthPerSecond.Value()) {
					t.Fatalf("expected max read bandwidth %v but got %v", daemonConfig.IOLimitConfig.ReadBandwidthPerSecond.Value(), ioMax.Read)
				}
				if ioMax.Write != uint64(daemonConfig.IOLimitConfig.WriteBandwidthPerSecond.Value()) {
					t.Fatalf("expected max write bandwidth %v but got %v", daemonConfig.IOLimitConfig.WriteBandwidthPerSecond.Value(), ioMax.Write)
				}
			}

			return testCtx
		}).Feature()

	testEnv.Test(t, f)
}
