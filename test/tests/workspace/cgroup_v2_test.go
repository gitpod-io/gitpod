// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"github.com/gitpod-io/gitpod/test/tests/workspace/common"
	"github.com/google/go-cmp/cmp"
)

func TestCgroupV2(t *testing.T) {
	f := features.New("cgroup v2").
		WithLabel("component", "workspace").
		Assess("it should create a new cgroup when cgroup v2 is enabled", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
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

			cgroupBase := "/sys/fs/cgroup/test"
			var respNewCgroup agent.ExecResponse
			err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
				Dir:     "/",
				Command: "bash",
				Args: []string{
					"-c",
					fmt.Sprintf("sudo mkdir %s", cgroupBase),
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
				"hugetlb",
				"pids",
				"rdma",
			}
			sort.Strings(expect)
			act := strings.Split(strings.TrimSuffix(respCheckControllers.Stdout, "\n"), " ")
			sort.Strings(act)
			if diff := cmp.Diff(act, expect); len(diff) != 0 {
				t.Errorf("cgroup v2 controllers mismatch (-want +got):\n%s", diff)
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
