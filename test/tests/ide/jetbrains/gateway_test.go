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
	BaseGuard(t)
	t.Parallel()
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
	BaseGuard(t)
	t.Parallel()
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
	BaseGuard(t)
	t.Parallel()
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
	BaseGuard(t)
	t.Parallel()
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
	BaseGuard(t)
	t.Parallel()
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
	BaseGuard(t)
	t.Parallel()
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
	BaseGuard(t)
	t.Parallel()
	t.Skip("Until ENT-56")
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
	BaseGuard(t)
	t.Parallel()
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
	BaseGuard(t)
	t.Parallel()
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

func TestIntellijNotPreconfiguredRepo(t *testing.T) {
	BaseGuard(t)
	t.Parallel()
	f := features.New("Start a workspace using Intellij with not preconfigured repo").
		WithLabel("component", "IDE").
		WithLabel("ide", "Intellij").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()
			// ENT-260
			// https://github.com/spring-projects/spring-petclinic is not an option because it will prompt to ask user to select project type
			// which will block integration test (UI tests)
			JetBrainsIDETest(ctx, t, cfg, WithIDE("intellij"), WithRepo("https://github.com/gitpod-io/empty"))
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}

//go:embed warmup-indexing.sh
var warmupIndexingShell []byte

func TestIntelliJWarmup(t *testing.T) {
	BaseGuard(t)
	t.Parallel()
	f := features.New("Start a workspace using Intellij and imagebuild to test warmup tasks").
		WithLabel("component", "IDE").
		WithLabel("ide", "Intellij").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()

			testRepo := "https://github.com/gitpod-samples/spring-petclinic"
			testRepoBranch := "gp/integration-test"

			api, _, papi, _ := MustConnectToServer(ctx, t, cfg)
			t.Logf("get or create team")
			teamID, err := api.GetTeam(ctx, papi)
			if err != nil {
				t.Fatalf("failed to get or create team: %v", err)
			}
			t.Logf("get or create repository for %s", testRepo)
			projectID, err := api.GetProject(ctx, papi, teamID, "petclinic", testRepo, true)
			if err != nil {
				t.Fatalf("failed to get or create project: %v", err)
			}

			triggerAndWaitForPrebuild := func() error {
				prebuildID, err := api.TriggerPrebuild(ctx, papi, projectID, testRepoBranch)
				if err != nil {
					return fmt.Errorf("failed to trigger prebuild: %v", err)
				}
				t.Logf("prebuild triggered, id: %s", prebuildID)
				ok, err := api.WaitForPrebuild(ctx, papi, prebuildID)
				if err != nil {
					return fmt.Errorf("failed to wait for prebuild: %v", err)
				}
				if !ok {
					return fmt.Errorf("prebuild failed")
				}
				// EXP-1860
				// Prebuild is marked as available before content back-up is completed
				if err := api.WaitForPrebuildWorkspaceToStoppedPhase(ctx, prebuildID); err != nil {
					return fmt.Errorf("failed to wait for prebuild workspace to be backed-up : %v", err)
				}
				return nil
			}

			t.Logf("trigger prebuild and wait for it")
			if err := triggerAndWaitForPrebuild(); err != nil {
				t.Fatalf("failed to trigger prebuild: %v", err)
			}
			t.Logf("prebuild available")

			t.Logf("warmup prebuild prepared, org: %s, repository: %s", teamID, projectID)

			JetBrainsIDETest(ctx, t, cfg, WithIDE("intellij"),
				WithRepo(fmt.Sprintf("%s/tree/%s", testRepo, testRepoBranch)),
				WithRepositoryID(projectID),
				WithAdditionRpcCall(func(rsa *integration.RpcClient, jbCtx *JetBrainsTestCtx) error {
					t.Logf("check if it has warmup.log")
					var resp agent.ExecResponse
					err := rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
						Dir:     "/",
						Command: "bash",
						Args: []string{
							"-c",
							fmt.Sprintf("stat %s/log/warmup/warmup.log", jbCtx.SystemDir),
						},
					}, &resp)
					if err != nil {
						return fmt.Errorf("warmup.log not found: %v", err)
					}
					if resp.ExitCode != 0 {
						return fmt.Errorf("warmup.log not found: %s, %d", resp.Stderr, resp.ExitCode)
					}
					return nil
				}),
				WithAdditionRpcCall(func(rsa *integration.RpcClient, jbCtx *JetBrainsTestCtx) error {
					t.Logf("sleep for 1 minute to wait project open")
					var resp agent.ExecResponse
					time.Sleep(1 * time.Minute)
					t.Logf("checking warmup indexing")
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
					t.Logf("output:\n%s", string(resp.Stdout))
					return nil
				}))
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}
