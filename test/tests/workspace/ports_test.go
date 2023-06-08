// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package workspace

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"
)

func TestRegularWorkspacePorts(t *testing.T) {
	userToken, _ := os.LookupEnv("USER_TOKEN")
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)

	// This branch exposes a python server on port 3000 as part of the Gitpod tasks.
	testRepo := "https://github.com/gitpod-io/gitpod-test-repo/tree/integration-test/ports"
	testRepoName := "gitpod-test-repo"
	wsLoc := fmt.Sprintf("/workspace/%s", testRepoName)

	f := features.New("ws-manager").
		WithLabel("component", "ws-manager").
		WithLabel("type", "ports").
		Assess("it can open and access workspace ports", func(ctx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			t.Parallel()

			ctx, cancel := context.WithTimeout(ctx, time.Duration(5*time.Minute))
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			_, err := api.CreateUser(username, userToken)
			if err != nil {
				t.Fatal(err)
			}

			serverOpts := []integration.GitpodServerOpt{integration.WithGitpodUser(username)}
			server, err := api.GitpodServer(serverOpts...)
			if err != nil {
				t.Fatal(err)
			}

			// Must change supervisor address from localhost to 10.0.5.2.
			err = server.SetEnvVar(ctx, &gitpod.UserEnvVarValue{
				Name:              "SUPERVISOR_ADDR",
				Value:             `10.0.5.2:22999`,
				RepositoryPattern: "gitpod-io/" + testRepoName,
			})
			if err != nil {
				t.Fatal(err)
			}
			defer func() {
				err := server.DeleteEnvVar(ctx, &gitpod.UserEnvVarValue{
					Name:              "SUPERVISOR_ADDR",
					RepositoryPattern: "gitpod-io/" + testRepoName,
				})
				if err != nil {
					t.Fatal(err)
				}
			}()

			nfo, stopWs, err := integration.LaunchWorkspaceFromContextURL(t, ctx, testRepo, username, api, integration.WithGitpodUser(username))
			if err != nil {
				t.Fatal(err)
			}

			t.Cleanup(func() {
				sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
				defer scancel()

				sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
				defer sapi.Done(t)

				if _, err = stopWs(true, sapi); err != nil {
					t.Errorf("cannot stop workspace: %q", err)
				}
			})

			instanceId := nfo.LatestInstance.ID
			rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(), integration.WithInstanceID(instanceId))
			integration.DeferCloser(t, closer)
			if err != nil {
				t.Fatalf("unexpected error instrumenting workspace: %v", err)
			}
			defer rsa.Close()

			type Port struct {
				LocalPort int `json:"localPort,omitempty"`
				Exposed   struct {
					Visibility string `json:"visibility,omitempty"`
					Url        string `json:"url,omitempty"`
				} `json:"exposed,omitempty"`
			}
			var portsResp struct {
				Result struct {
					Ports []*Port `json:"ports,omitempty"`
				} `json:"result"`
			}

			// Wait for port auto-detection to pick up the open port.
			time.Sleep(4 * time.Second)

			expectPort := func(expected Port) {
				var res agent.ExecResponse
				err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
					Dir:     wsLoc,
					Command: "curl",
					// nftable rule only forwards to this ip address
					Args: []string{"10.0.5.2:22999/_supervisor/v1/status/ports"},
				}, &res)
				if err != nil {
					t.Fatal(err)
				}
				err = json.Unmarshal([]byte(res.Stdout), &portsResp)
				if err != nil {
					t.Fatalf("cannot decode supervisor ports status response: %s", err)
				}

				t.Logf("ports: %s (%d)", res.Stdout, res.ExitCode)
				if len(portsResp.Result.Ports) != 1 {
					t.Fatalf("expected one port to be open, but got %d", len(portsResp.Result.Ports))
				}
				if !reflect.DeepEqual(expected, *portsResp.Result.Ports[0]) {
					t.Fatalf("expected %v but got %v", expected, *portsResp.Result.Ports[0])
				}
			}

			t.Logf("checking that port has been auto-detected, and is private")
			portUrl := fmt.Sprintf("https://%d-%s", 3000, strings.TrimPrefix(nfo.LatestInstance.IdeURL, "https://"))
			expectPort(Port{
				LocalPort: 3000,
				Exposed: struct {
					Visibility string `json:"visibility,omitempty"`
					Url        string `json:"url,omitempty"`
				}{
					Visibility: "private",
					Url:        portUrl,
				},
			})

			t.Logf("checking that private port is not accessible from outside the workspace at %s", portUrl)
			res, err := http.Get(portUrl)
			if err != nil {
				t.Fatal(err)
			}
			if res.StatusCode != http.StatusUnauthorized {
				t.Fatalf("expected status code 401, but got %d", res.StatusCode)
			}

			// Make port public.
			t.Logf("making port public via gp ports visibility")
			var res1 agent.ExecResponse
			err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
				Dir:     wsLoc,
				Command: "gp",
				// nftable rule only forwards to this ip address
				Args: []string{"ports", "visibility", "3000:public"},
			}, &res1)
			if err != nil {
				t.Fatal(err)
			}
			t.Logf("debug: gp CLI output: %s, %s, %d", res1.Stdout, res1.Stderr, res1.ExitCode)

			// Wait for workspace to pick up the port change.
			time.Sleep(3 * time.Second)
			t.Logf("checking that port is now public")
			expectPort(Port{
				LocalPort: 3000,
				Exposed: struct {
					Visibility string `json:"visibility,omitempty"`
					Url        string `json:"url,omitempty"`
				}{
					Visibility: "public",
					Url:        portUrl,
				},
			})

			t.Logf("checking if port is accessible from outside the workspace at %s", portUrl)
			res, err = http.Get(portUrl)
			if err != nil {
				t.Fatal(err)
			}
			if res.StatusCode != http.StatusOK {
				t.Fatalf("expected status code 200, but got %d", res.StatusCode)
			}

			return ctx
		}).
		Feature()

	testEnv.Test(t, f)
}
