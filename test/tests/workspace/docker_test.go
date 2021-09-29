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
)

func TestRunDocker(t *testing.T) {
	f := features.New("docker").
		WithLabel("component", "workspace").
		Assess("it should start a container", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			ws, err := integration.LaunchWorkspaceDirectly(ctx, api)
			if err != nil {
				t.Fatal(err)
			}

			rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), cfg.Client(), integration.WithInstanceID(ws.Req.Id), integration.WithWorkspacekitLift(true))
			if err != nil {
				t.Fatalf("unexpected error instrumenting workspace: %v", err)
			}
			defer rsa.Close()
			integration.DeferCloser(t, closer)

			var resp agent.ExecResponse
			err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
				Dir:     "/",
				Command: "bash",
				Args: []string{
					"-c",
					"docker run --rm alpine:latest",
				},
			}, &resp)
			if err != nil {
				t.Fatalf("docker run failed: %v\n%s\n%s", err, resp.Stdout, resp.Stderr)
			}

			if resp.ExitCode != 0 {
				t.Fatalf("docker run failed: %s\n%s", resp.Stdout, resp.Stderr)
			}

			err = integration.DeleteWorkspace(ctx, api, ws.Req.Id)
			if err != nil {
				t.Fatal(err)
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
