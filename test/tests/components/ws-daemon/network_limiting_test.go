// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsdaemon

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/common-go/kubernetes"
	daemon "github.com/gitpod-io/gitpod/test/pkg/agent/daemon/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	corev1 "k8s.io/api/core/v1"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"
)

func TestNetworkLimiting(t *testing.T) {
	userToken, _ := os.LookupEnv("USER_TOKEN")
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)

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

			_, err := api.CreateUser(username, userToken)
			if err != nil {
				t.Fatal(err)
			}

			ws, stopWs, err := integration.LaunchWorkspaceFromContextURL(t, ctx, "https://github.com/gitpod-io/empty", username, api, integration.WithGitpodUser(username))
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
				integration.WithContainer("ws-daemon"),
			)
			if err != nil {
				t.Fatalf("unexpected error instrumenting daemon: %v", err)
			}
			defer daemonClient.Close()
			integration.DeferCloser(t, daemonCloser)

			t.Logf("checking if workspace pod has network limit annotation")
			var pod corev1.Pod
			if err := cfg.Client().Resources().Get(ctx, "ws-"+ws.LatestInstance.ID, cfg.Namespace(), &pod); err != nil {
				t.Fatal(err)
			}
			annotation, ok := pod.Annotations[kubernetes.WorkspaceNetConnLimitAnnotation]
			if !ok {
				t.Fatalf("expected annotation %s to be present on workspace pod but wasn't", kubernetes.WorkspaceNetConnLimitAnnotation)
			}
			if annotation != "true" {
				t.Fatalf("expected annotation %s to be true but was %s", kubernetes.WorkspaceNetConnLimitAnnotation, annotation)
			}

			t.Logf("checking nftable rules for rate limiting")
			containerId := getCalicoContainerId(&pod)
			var resp daemon.VerifyRateLimitingRuleResponse
			err = daemonClient.Call("DaemonAgent.VerifyRateLimitingRule", daemon.VerifyRateLimitingRuleRequest{
				ContainerId: containerId,
			}, &resp)
			if err != nil {
				t.Errorf("error verifying rate limiting rule for container %s: %v", containerId, err)
			}

			t.Logf("verified rate limiting rule")

			return testCtx
		}).Feature()

	testEnv.Test(t, f)
}

func getCalicoContainerId(pod *corev1.Pod) string {
	return pod.Annotations["cni.projectcalico.org/containerID"]
}
