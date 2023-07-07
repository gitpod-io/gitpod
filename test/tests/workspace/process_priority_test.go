// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"
)

func TestProcessPriority(t *testing.T) {
	userToken, _ := os.LookupEnv("USER_TOKEN")
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)

	f := features.New("process priority").
		WithLabel("component", "workspace").
		WithLabel("type", "process priority").
		Assess("it has set process priority", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			t.Parallel()

			ctx, cancel := context.WithTimeout(testCtx, time.Duration(5*time.Minute))
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			_, err := api.CreateUser(username, userToken)
			if err != nil {
				t.Fatal(err)
			}

			nfo, stopWs, err := integration.LaunchWorkspaceFromContextURL(t, ctx, "https://github.com/gitpod-io/empty", username, api, integration.WithGitpodUser(username))
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

			rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(), integration.WithInstanceID(nfo.LatestInstance.ID))
			integration.DeferCloser(t, closer)
			if err != nil {
				t.Fatalf("unexpected error instrumenting workspace: %v", err)
			}
			defer rsa.Close()

			t.Logf("running ps")
			var res agent.ExecResponse
			err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
				Dir:     "/workspace",
				Command: "ps",
				Args:    []string{"eax", "-o", "ni,cmd", "--no-headers"},
			}, &res)
			if err != nil {
				t.Fatal(err)
			}
			if res.ExitCode != 0 {
				t.Fatalf("ps failed (%d): %s", res.ExitCode, res.Stderr)
			}

			checkProcessPriorities(t, res.Stdout)

			return testCtx
		}).
		Feature()

	testEnv.Test(t, f)
}

func checkProcessPriorities(t *testing.T, output string) {
	t.Helper()

	processes := strings.Split(output, "\n")
	for _, p := range processes {
		parts := strings.Fields(p)
		if len(parts) >= 2 {
			checkProcessPriority(t, parts[0], parts[1])
		}
	}
}

func checkProcessPriority(t *testing.T, priority, process string) {
	t.Helper()

	actualPrio, err := strconv.Atoi(priority)
	if err != nil {
		return
	}

	expectedPrio, err := determinePriority(process)
	if err != nil {
		return
	}

	if actualPrio != expectedPrio {
		t.Fatalf("expected priority of %v for process %v, but was %v", expectedPrio, process, actualPrio)
	}
}

func determinePriority(process string) (int, error) {
	if strings.HasSuffix(process, "supervisor") {
		return -10, nil
	}

	if strings.HasSuffix(process, "/bin/code-server") {
		return -10, nil
	}

	if strings.HasSuffix(process, "/ide/bin/gitpod-code") {
		return -10, nil
	}

	if strings.HasSuffix(process, "/ide/node") {
		return -5, nil
	}

	return 0, fmt.Errorf("unknown")
}
