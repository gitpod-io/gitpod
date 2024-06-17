// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package ide

import (
	"context"
	_ "embed"
	"fmt"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

func TestGoLand(t *testing.T) {
	f := features.New("Start a workspace using GoLand").
		WithLabel("component", "IDE").
		WithLabel("ide", "GoLand").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()
			JetBrainsIDETest(ctx, t, cfg, WithIDE("goland"))
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}

func TestIntellij(t *testing.T) {
	f := features.New("Start a workspace using Intellij").
		WithLabel("component", "IDE").
		WithLabel("ide", "Intellij").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()

			JetBrainsIDETest(ctx, t, cfg, WithIDE("intellij"))
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}

func TestPhpStorm(t *testing.T) {
	f := features.New("Start a workspace using PhpStorm").
		WithLabel("component", "IDE").
		WithLabel("ide", "PhpStorm").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()
			JetBrainsIDETest(ctx, t, cfg, WithIDE("phpstorm"))
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}

func TestPyCharm(t *testing.T) {
	f := features.New("Start a workspace using Pycharm").
		WithLabel("component", "IDE").
		WithLabel("ide", "Pycharm").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()
			JetBrainsIDETest(ctx, t, cfg, WithIDE("pycharm"))
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}

func TestRubyMine(t *testing.T) {
	f := features.New("Start a workspace using RubyMine").
		WithLabel("component", "IDE").
		WithLabel("ide", "RubyMine").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()
			JetBrainsIDETest(ctx, t, cfg, WithIDE("rubymine"))
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}

func TestWebStorm(t *testing.T) {
	f := features.New("Start a workspace using WebStorm").
		WithLabel("component", "IDE").
		WithLabel("ide", "WebStorm").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()
			JetBrainsIDETest(ctx, t, cfg, WithIDE("webstorm"))
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}

func TestRider(t *testing.T) {
	if roboquatToken == "" {
		t.Skip("this test need github action run permission")
	}
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)
	f := features.New("Start a workspace using Rider").
		WithLabel("component", "IDE").
		WithLabel("ide", "Rider").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()
			JetBrainsIDETest(ctx, t, cfg, WithIDE("rider"))
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}

func TestCLion(t *testing.T) {
	if roboquatToken == "" {
		t.Skip("this test need github action run permission")
	}
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)
	t.Skip("See EXP-414")
	f := features.New("Start a workspace using CLion").
		WithLabel("component", "IDE").
		WithLabel("ide", "CLion").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()
			JetBrainsIDETest(ctx, t, cfg, WithIDE("clion"))
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}

func TestRustRover(t *testing.T) {
	if roboquatToken == "" {
		t.Skip("this test need github action run permission")
	}
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)
	f := features.New("Start a workspace using RustRover").
		WithLabel("component", "IDE").
		WithLabel("ide", "RustRover").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()
			JetBrainsIDETest(ctx, t, cfg, WithIDE("rustrover"))
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}

func TestIntellijEmptyRepo(t *testing.T) {
	f := features.New("Start a workspace using Intellij and empty folder").
		WithLabel("component", "IDE").
		WithLabel("ide", "Intellij").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()
			JetBrainsIDETest(ctx, t, cfg, WithIDE("intellij"), WithRepo("https://github.com/gitpod-io/empty"))
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}

//go:embed warmup-indexing.sh
var warmupIndexingShell []byte

func TestIntelliJWarmup(t *testing.T) {
	f := features.New("Start a workspace using Intellij and imagebuild to test warmup tasks").
		WithLabel("component", "IDE").
		WithLabel("ide", "Intellij").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			BaseGuard(t)
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()

			testRepo := "https://github.com/gitpod-samples/spring-petclinic/tree/gp/integration-test"

			// trigger a warmup prebuild
			triggerAndWaitForPrebuild := func() error {
				api, _, papi, _ := MustConnectToServer(ctx, t, cfg)
				teamID, err := api.GetTeam(ctx, papi)
				if err != nil {
					return fmt.Errorf("failed to get or create team: %v", err)
				}
				projectID, err := api.CreateProject(ctx, papi, teamID, "petclinic", testRepo, true)
				if err != nil {
					return fmt.Errorf("failed to create project: %v", err)
				}

				prebuildID, err := api.TriggerPrebuild(ctx, papi, projectID, "gp/integration-test")
				if err != nil {
					return fmt.Errorf("failed to trigger prebuild: %v", err)
				}

				ok, err := api.WaitForPrebuild(ctx, papi, prebuildID)
				if err != nil {
					return fmt.Errorf("failed to wait for prebuild: %v", err)
				}
				if !ok {
					return fmt.Errorf("prebuild failed")
				}
				return nil
			}

			if err := triggerAndWaitForPrebuild(); err != nil {
				t.Fatalf("failed to trigger prebuild: %v", err)
			}

			JetBrainsIDETest(ctx, t, cfg, WithIDE("intellij"), WithRepo(testRepo), WithAdditionRpcCall(func(rsa *integration.RpcClient, jbCtx *JetBrainsTestCtx) error {
				var resp agent.ExecResponse
				err := rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
					Dir:     "/",
					Command: "bash",
					Args: []string{
						"-c",
						string(warmupIndexingShell),
						"--",
						jbCtx.SystemDir,
					},
				}, &resp)
				if err != nil {
					return fmt.Errorf("failed to warmup indexing: %v", err)
				}
				if resp.ExitCode != 0 {
					return fmt.Errorf("failed to warmup indexing: %s, %d", resp.Stderr, resp.ExitCode)
				}
				return nil
			}))
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}
