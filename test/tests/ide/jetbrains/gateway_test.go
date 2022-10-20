// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ide

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"golang.org/x/oauth2"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/google/go-github/v42/github"
)

var ideProjectMap map[string]string

type GatewayHostStatus struct {
	AppPid     int64  `json:"appPid"`
	AppVersion string `json:"appVersion"`
	IdePath    string `json:"idePath"`
	Projects   []struct {
		BackgroundTasksRunning             bool     `json:"backgroundTasksRunning"`
		ControllerConnected                bool     `json:"controllerConnected"`
		GatewayLink                        string   `json:"gatewayLink"`
		HTTPLink                           string   `json:"httpLink"`
		JoinLink                           string   `json:"joinLink"`
		ProjectName                        string   `json:"projectName"`
		ProjectPath                        string   `json:"projectPath"`
		SecondsSinceLastControllerActivity int64    `json:"secondsSinceLastControllerActivity"`
		Users                              []string `json:"users"`
	} `json:"projects"`
	RuntimeVersion string `json:"runtimeVersion"`
	UnattendedMode bool   `json:"unattendedMode"`
}

func init() {
	ideProjectMap = make(map[string]string)
	ideProjectMap["goland"] = "https://github.com/gitpod-io/template-golang-cli"
	ideProjectMap["intellij"] = "https://github.com/gitpod-io/spring-petclinic"
	ideProjectMap["phpstorm"] = "https://github.com/gitpod-io/template-php-laravel-mysql"
	ideProjectMap["pycharm"] = "https://github.com/gitpod-io/template-python-django"
	ideProjectMap["rubymine"] = "https://github.com/gitpod-io/template-ruby-on-rails-postgres"
	ideProjectMap["webstorm"] = "https://github.com/gitpod-io/template-typescript-react"
}

func GetHttpContent(url string) ([]byte, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, err := ioutil.ReadAll(resp.Body)
	return b, err
}

func TestJetBrainsGatewayWorkspace(t *testing.T) {
	userToken, _ := os.LookupEnv("USER_TOKEN")
	roboquatToken, ok := os.LookupEnv("ROBOQUAT_TOKEN")
	if !ok {
		t.Skip("this test need github action run permission")
	}
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)

	var featureList []features.Feature

	for n, r := range ideProjectMap {
		ideName := n
		repo := r
		f := features.New("Start a workspace using "+ideName).
			WithLabel("component", "IDE").
			WithLabel("ide", ideName).
			Assess("it can let JetBrains Gateway connect", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
				defer cancel()

				api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
				t.Cleanup(func() {
					api.Done(t)
				})

				config, err := integration.GetServerConfig(cfg.Namespace(), cfg.Client())
				if err != nil {
					t.Fatal(err)
				}

				t.Logf("get or create user")
				_, err = api.CreateUser(username, userToken)
				if err != nil {
					t.Fatal(err)
				}
				err = api.MakeUserUnleashedPlan(username)
				if err != nil {
					t.Fatal(err)
				}

				t.Logf("connecting to server...")
				server, err := api.GitpodServer(integration.WithGitpodUser(username))
				if err != nil {
					t.Fatal(err)
				}
				t.Logf("connected to server")

				t.Logf("starting workspace")
				var nfo *protocol.WorkspaceInfo
				var stopWs func(waitForStop bool, api *integration.ComponentAPI) (*wsmanapi.WorkspaceStatus, error)

				for i := 0; i < 3; i++ {
					nfo, stopWs, err = integration.LaunchWorkspaceFromContextURL(t, ctx, "referrer:jetbrains-gateway:"+ideName+"/"+repo, username, api)
					if err != nil {
						if strings.Contains(err.Error(), "code 429 message: too many requests") {
							t.Log(err)
							time.Sleep(10 * time.Second)
							continue
						}
						t.Fatal(err)
					} else {
						break
					}
				}

				defer func() {
					sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
					defer scancel()

					sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
					defer sapi.Done(t)

					stopWs(true, sapi)
				}()

				t.Logf("get oauth2 token")
				oauthToken, err := api.CreateOAuth2Token(username, []string{
					"function:getGitpodTokenScopes",
					"function:getIDEOptions",
					"function:getOwnerToken",
					"function:getWorkspace",
					"function:getWorkspaces",
					"function:listenForWorkspaceInstanceUpdates",
					"resource:default",
				})
				if err != nil {
					t.Fatal(err)
				}

				t.Logf("make port 63342 public")
				_, err = server.OpenPort(ctx, nfo.Workspace.ID, &protocol.WorkspaceInstancePort{Port: 63342, Visibility: "public"})
				if err != nil {
					t.Fatal(err)
				}

				gatewayLink := fmt.Sprintf("jetbrains-gateway://connect#gitpodHost=%s&workspaceId=%s", strings.TrimPrefix(config.HostURL, "https://"), nfo.Workspace.ID)

				ts := oauth2.StaticTokenSource(
					&oauth2.Token{AccessToken: roboquatToken},
				)
				tc := oauth2.NewClient(ctx, ts)

				githubClient := github.NewClient(tc)

				t.Logf("trigger github action")
				_, err = githubClient.Actions.CreateWorkflowDispatchEventByFileName(ctx, "gitpod-io", "gitpod", "jetbrains-integration-test.yml", github.CreateWorkflowDispatchEventRequest{
					Ref: "main",
					Inputs: map[string]interface{}{
						"secret_gateway_link": gatewayLink,
						"secret_access_token": oauthToken,
						"secret_endpoint":     strings.TrimPrefix(nfo.LatestInstance.IdeURL, "https://"),
					},
				})
				if err != nil {
					t.Fatal(err)
				}

				checkUrl := fmt.Sprintf("https://63342-%s/codeWithMe/unattendedHostStatus?token=gitpod", strings.TrimPrefix(nfo.LatestInstance.IdeURL, "https://"))

				t.Logf("waiting result")
				testStatus := false
				for ctx.Err() == nil {
					time.Sleep(1 * time.Second)
					body, _ := GetHttpContent(checkUrl)
					var status GatewayHostStatus
					err = json.Unmarshal(body, &status)
					if err != nil {
						continue
					}
					if len(status.Projects) == 1 && status.Projects[0].ControllerConnected {
						testStatus = true
						break
					}
				}
				if !testStatus {
					t.Fatal(ctx.Err())
				}
				time.Sleep(time.Second * 10)
				return ctx
			}).
			Feature()
		featureList = append(featureList, f)
	}

	testEnv.TestInParallel(t, featureList...)
}
