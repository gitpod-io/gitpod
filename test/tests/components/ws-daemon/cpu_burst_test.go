// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsdaemon

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	daemon "github.com/gitpod-io/gitpod/test/pkg/agent/daemon/api"
	wsapi "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
)

type DaemonConfig struct {
	CpuLimitConfig struct {
		Enabled    bool  `json:"enabled"`
		Limit      int64 `json:"limit,string"`
		BurstLimit int64 `json:"burstLimit,string"`
	} `json:"cpuLimit"`
	IOLimitConfig struct {
		WriteBandwidthPerSecond resource.Quantity `json:"writeBandwidthPerSecond"`
		ReadBandwidthPerSecond  resource.Quantity `json:"readBandwidthPerSecond"`
		WriteIOPS               int64             `json:"writeIOPS"`
		ReadIOPS                int64             `json:"readIOPS"`
	} `json:"ioLimit"`
}

func TestCpuBurst(t *testing.T) {
	f := features.New("cpulimiting").WithLabel("component", "ws-daemon").Assess("check cpu limiting", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
		t.Parallel()

		ctx, cancel := context.WithTimeout(testCtx, 8*time.Minute)
		defer cancel()

		api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
		t.Cleanup(func() {
			api.Done(t)
		})

		daemonConfig := getDaemonConfig(ctx, t, cfg)
		if !daemonConfig.CpuLimitConfig.Enabled {
			t.Fatal("cpu limiting is not enabled")
		}

		if daemonConfig.CpuLimitConfig.Limit == 0 {
			t.Fatal("cpu limit is not set")
		}
		if daemonConfig.CpuLimitConfig.BurstLimit == 0 {
			t.Fatal("cpu burst limit is not set")
		}
		daemonConfig.CpuLimitConfig.Limit = daemonConfig.CpuLimitConfig.Limit * 100_000
		daemonConfig.CpuLimitConfig.BurstLimit = daemonConfig.CpuLimitConfig.BurstLimit * 100_000

		swr := func(req *wsmanapi.StartWorkspaceRequest) error {
			req.Spec.Initializer = &csapi.WorkspaceInitializer{
				Spec: &csapi.WorkspaceInitializer_Git{
					Git: &csapi.GitInitializer{
						RemoteUri:        "https://github.com/gitpod-io/empty",
						CheckoutLocation: "empty",
						Config:           &csapi.GitConfig{},
					},
				},
			}

			req.Spec.WorkspaceLocation = "empty"
			return nil
		}

		ws, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(swr))
		if err != nil {
			t.Fatal(err)
		}
		defer func() {
			sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer scancel()

			sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
			defer sapi.Done(t)

			_, err = stopWs(true, sapi)
			if err != nil {
				t.Errorf("cannot stop workspace: %q", err)
			}
		}()

		daemonClient, daemonCloser, err := integration.Instrument(integration.ComponentWorkspaceDaemon, "daemon", cfg.Namespace(), kubeconfig, cfg.Client(),
			integration.WithWorkspacekitLift(false),
			integration.WithContainer("ws-daemon"),
		)

		if err != nil {
			t.Fatal(err)
		}
		integration.DeferCloser(t, daemonCloser)

		var pod corev1.Pod
		if err := cfg.Client().Resources().Get(ctx, "ws-"+ws.Req.Id, cfg.Namespace(), &pod); err != nil {
			t.Fatal(err)
		}

		containerId := getWorkspaceContainerId(&pod)
		var resp daemon.GetWorkspaceResourcesResponse
		for i := 0; i < 10; i++ {
			err = daemonClient.Call("DaemonAgent.GetWorkspaceResources", daemon.GetWorkspaceResourcesRequest{
				ContainerId: containerId,
			}, &resp)

			if resp.CpuQuota == daemonConfig.CpuLimitConfig.Limit {
				break
			}
			time.Sleep(5 * time.Second)
		}

		if err != nil {
			t.Fatalf("cannot get workspace resources: %q", err)
		}

		if resp.CpuQuota != daemonConfig.CpuLimitConfig.Limit {
			t.Fatalf("expected cpu limit quota of %v, but was %v", daemonConfig.CpuLimitConfig.Limit, resp.CpuQuota)
		}

		workspaceClient, workspaceCloser, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(),
			integration.WithInstanceID(ws.Req.Id),
			integration.WithContainer("workspace"),
			integration.WithWorkspacekitLift(true),
		)
		if err != nil {
			t.Fatal(err)
		}
		integration.DeferCloser(t, workspaceCloser)

		var cpuResp wsapi.BurnCpuResponse
		go func() {
			err := workspaceClient.Call("WorkspaceAgent.BurnCpu", &wsapi.BurnCpuRequest{
				Timeout: 30 * time.Second,
				Procs:   12,
			}, &cpuResp)

			if err != nil && err.Error() != "unexpected EOF" {
				t.Logf("error performing cpu burn: %q", err)
			}
		}()

		for i := 0; i < 8; i++ {
			err = daemonClient.Call("DaemonAgent.GetWorkspaceResources", daemon.GetWorkspaceResourcesRequest{
				ContainerId: containerId,
			}, &resp)

			if resp.CpuQuota == daemonConfig.CpuLimitConfig.BurstLimit {
				break
			}
			time.Sleep(5 * time.Second)
		}

		if err != nil {
			t.Fatalf("cannot get workspace resources: %q", err)
		}

		if resp.CpuQuota != daemonConfig.CpuLimitConfig.BurstLimit {
			t.Fatalf("expected cpu burst limit quota of %v, but was %v", daemonConfig.CpuLimitConfig.BurstLimit, resp.CpuQuota)
		}
		return testCtx
	}).Feature()

	testEnv.Test(t, f)
}

func getDaemonConfig(ctx context.Context, t *testing.T, cfg *envconf.Config) DaemonConfig {
	var daemonConfigMap corev1.ConfigMap

	if err := cfg.Client().Resources().Get(ctx, "ws-daemon", cfg.Namespace(), &daemonConfigMap); err != nil {
		t.Fatal(err)
	}

	data, ok := daemonConfigMap.Data["config.json"]
	if !ok {
		t.Fatal("server config map does not contain config.json")
	}

	config := make(map[string]json.RawMessage)
	if err := json.Unmarshal([]byte(data), &config); err != nil {
		t.Fatal(err)
	}

	var daemonConfig DaemonConfig
	if err := json.Unmarshal(config["daemon"], &daemonConfig); err != nil {
		t.Fatal(err)
	}

	return daemonConfig
}

func getWorkspaceContainerId(pod *corev1.Pod) string {
	for _, c := range pod.Status.ContainerStatuses {
		if c.Name != "workspace" {
			continue
		}

		return strings.TrimPrefix(c.ContainerID, "containerd://")
	}

	return ""
}
