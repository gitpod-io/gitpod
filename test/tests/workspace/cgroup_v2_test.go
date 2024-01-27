// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"golang.org/x/exp/slices"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"github.com/gitpod-io/gitpod/test/pkg/report"
)

func TestCgroupV2(t *testing.T) {
	f := features.New("cgroup v2").
		WithLabel("component", "workspace").
		Assess("it should have cgroup v2 enabled and create a new cgroup", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			report.SetupReport(t, report.FeatureResourceLimit, "this is the test for cgroup v2")
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
				t.Fatalf("expected cgroup v2 to be enabled")
			}

			cgroupBase := "/sys/fs/cgroup/test"
			var respNewCgroup agent.ExecResponse
			err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
				Dir:     "/",
				Command: "bash",
				Args: []string{
					"-c",
					fmt.Sprintf("if [ ! -e %s ]; then sudo mkdir %s; fi", cgroupBase, cgroupBase),
				},
			}, &respNewCgroup)
			if err != nil {
				t.Fatalf("new cgroup create failed: %v\n%s\n%s", err, respNewCgroup.Stdout, respNewCgroup.Stderr)
			}

			if respNewCgroup.ExitCode != 0 {
				t.Fatalf("new cgroup create failed: %s\n%s", respNewCgroup.Stdout, respNewCgroup.Stderr)
			}

			var respCheckControllers agent.ExecResponse
			err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
				Dir:     "/",
				Command: "bash",
				Args: []string{
					"-c",
					fmt.Sprintf("cat %s", filepath.Join(cgroupBase, "cgroup.controllers")),
				},
			}, &respCheckControllers)
			if err != nil {
				t.Fatalf("cgroup v2 controllers check failed: %v\n%s\n%s", err, respCheckControllers.Stdout, respCheckControllers.Stderr)
			}

			if respCheckControllers.ExitCode != 0 {
				t.Fatalf("cgroup v2 controllers check failed: %s\n%s", respCheckControllers.Stdout, respCheckControllers.Stderr)
			}

			expect := []string{
				"cpuset",
				"cpu",
				"io",
				"memory",
				"pids",
			}
			sort.Strings(expect)
			act := strings.Split(strings.TrimSuffix(respCheckControllers.Stdout, "\n"), " ")
			sort.Strings(act)

			for _, resouce := range expect {
				if !slices.Contains(act, resouce) {
					t.Errorf("cgroup v2 controllers doesn't have %s", resouce)
				}
			}

			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}
