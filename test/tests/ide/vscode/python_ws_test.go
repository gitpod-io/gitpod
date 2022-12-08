// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package ide

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

func poolTask(task func() (bool, error)) (bool, error) {
	timeout := time.After(10 * time.Minute)
	ticker := time.Tick(20 * time.Second)
	for {
		select {
		case <-timeout:
			return false, errors.New("timed out")
		case <-ticker:
			ok, err := task()
			if err != nil {
				return false, err
			} else if ok {
				return true, nil
			}
		}
	}
}

func TestPythonExtWorkspace(t *testing.T) {
	userToken, _ := os.LookupEnv("USER_TOKEN")
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)

	f := features.New("PythonExtensionWorkspace").
		WithLabel("component", "server").
		Assess("it can run python extension in a workspace", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			userId, err := api.CreateUser(username, userToken)
			if err != nil {
				t.Fatal(err)
			}

			serverOpts := []integration.GitpodServerOpt{integration.WithGitpodUser(username)}
			server, err := api.GitpodServer(serverOpts...)
			if err != nil {
				t.Fatal(err)
			}

			_, err = server.UpdateLoggedInUser(ctx, &protocol.User{
				AdditionalData: &protocol.AdditionalUserData{
					IdeSettings: &protocol.IDESettings{
						DefaultIde: "code-latest",
					},
				},
			})
			if err != nil {
				t.Fatalf("cannot set ide to vscode insiders: %q", err)
			}

			nfo, stopWs, err := integration.LaunchWorkspaceFromContextURL(t, ctx, "github.com/gitpod-io/python-test-workspace", username, api)
			if err != nil {
				t.Fatal(err)
			}
			defer func() {
				sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
				defer scancel()

				sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
				defer sapi.Done(t)

				stopWs(true, sapi)
			}()

			_, err = integration.WaitForWorkspaceStart(t, ctx, nfo.LatestInstance.ID, nfo.Workspace.ID, api)
			if err != nil {
				t.Fatal(err)
			}

			serverConfig, err := integration.GetServerConfig(cfg.Namespace(), cfg.Client())
			if err != nil {
				t.Fatal(err)
			}

			hash := sha256.Sum256([]byte(userId + serverConfig.Session.Secret))
			secretKey, err := api.CreateGitpodOneTimeSecret(fmt.Sprintf("%x", hash))
			if err != nil {
				t.Fatal(err)
			}

			sessionCookie, err := api.GitpodSessionCookie(userId, secretKey)
			if err != nil {
				t.Fatal(err)
			}

			rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(), integration.WithInstanceID(nfo.LatestInstance.ID), integration.WithWorkspacekitLift(true))
			if err != nil {
				t.Fatal(err)
			}
			defer rsa.Close()
			integration.DeferCloser(t, closer)

			_, err = poolTask(func() (bool, error) {
				var resp agent.ExecResponse
				err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
					Dir:     "/workspace/python-test-workspace",
					Command: "test",
					Args: []string{
						"-f",
						"__init_task_done__",
					},
				}, &resp)

				return resp.ExitCode == 0, nil
			})
			if err != nil {
				t.Fatal(err)
			}

			jsonCookie := fmt.Sprintf(
				`{"name": "%v","value": "%v","domain": "%v","path": "%v","expires": %v,"httpOnly": %v,"secure": %v,"sameSite": "Lax"}`,
				sessionCookie.Name,
				sessionCookie.Value,
				sessionCookie.Domain,
				sessionCookie.Path,
				sessionCookie.Expires.Unix(),
				sessionCookie.HttpOnly,
				sessionCookie.Secure,
			)

			var resp agent.ExecResponse
			err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
				Dir:     "/workspace/python-test-workspace",
				Command: "yarn",
				Args: []string{
					"gp-code-server-test",
					fmt.Sprintf("--endpoint=%s", nfo.LatestInstance.IdeURL),
					"--workspacePath=./src/testWorkspace",
					"--extensionDevelopmentPath=./out",
					"--extensionTestsPath=./out/test/suite",
				},
				Env: []string{
					fmt.Sprintf("AUTH_COOKIE=%s", base64.StdEncoding.EncodeToString([]byte(jsonCookie))),
				},
			}, &resp)

			if err != nil {
				t.Fatal(err)
			}

			t.Log("Ide integration stdout:\n", resp.Stdout)
			if resp.ExitCode != 0 {
				t.Log("Ide integration stderr:\n", resp.Stderr)
				t.Fatal("There was an error running ide test")
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
