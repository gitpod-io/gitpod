// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ide

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
)

func poolTask(task func() (bool, error)) (bool, error) {
	timeout := time.After(5 * time.Minute)
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
	f := features.New("PythonExtensionWorkspace").
		WithLabel("component", "server").
		Assess("it can run python extension in a workspace", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			nfo, stopWs, err := integration.LaunchWorkspaceFromContextURL(ctx, "github.com/jeanp413/python-test-workspace", username, api)
			if err != nil {
				t.Fatal(err)
			}
			defer stopWs(true)

			_, err = integration.WaitForWorkspaceStart(ctx, nfo.LatestInstance.ID, api)
			if err != nil {
				t.Fatal(err)
			}

			serverConfig, err := integration.GetServerConfig(cfg.Namespace(), cfg.Client())
			if err != nil {
				t.Fatal(err)
			}
			userId, err := api.GetUserId(username)
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

			rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), cfg.Client(), integration.WithInstanceID(nfo.LatestInstance.ID), integration.WithWorkspacekitLift(true))
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
					"openvscode-server-test",
					fmt.Sprintf("--endpoint=%s", nfo.LatestInstance.IdeURL),
					fmt.Sprintf("--authCookie=%s", base64.StdEncoding.EncodeToString([]byte(jsonCookie))),
					"--workspacePath=./src/testWorkspace",
					"--extensionDevelopmentPath=./out",
					"--extensionTestsPath=./out/test/suite",
				},
			}, &resp)

			if err != nil {
				t.Fatal(err)
			}

			if resp.ExitCode != 0 {
				t.Log("Ide integration stdout:\n", resp.Stdout)
				t.Log("Ide integration stderr:\n", resp.Stderr)
				t.Fatal("There was an error running ide test")
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
