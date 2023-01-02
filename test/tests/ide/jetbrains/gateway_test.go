// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

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

var (
	userToken     string
	roboquatToken string
)

func init() {
	userToken, _ = os.LookupEnv("USER_TOKEN")
	roboquatToken, _ = os.LookupEnv("ROBOQUAT_TOKEN")
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

func JetBrainsIDETest(ctx context.Context, t *testing.T, cfg *envconf.Config, ideName string, repo string) {
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

		_, _ = stopWs(true, sapi)
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
}

// func TestGoLand(t *testing.T) {
// 	integration.SkipWithoutUsername(t, username)
// 	integration.SkipWithoutUserToken(t, userToken)
// 	if roboquatToken == "" {
// 		t.Fatal("this test need github action run permission")
// 	}
// 	f := features.New("Start a workspace using GoLand").
// 		WithLabel("component", "IDE").
// 		WithLabel("ide", "GoLand").
// 		Assess("it can let JetBrains Gateway connect", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
// 			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
// 			defer cancel()
// 			JetBrainsIDETest(ctx, t, cfg, "goland", "https://github.com/gitpod-samples/template-golang-cli")
// 			return ctx
// 		}).
// 		Feature()
// 	testEnv.Test(t, f)
// }

// func TestIntellij(t *testing.T) {
// 	integration.SkipWithoutUsername(t, username)
// 	integration.SkipWithoutUserToken(t, userToken)
// 	if roboquatToken == "" {
// 		t.Fatal("this test need github action run permission")
// 	}
// 	f := features.New("Start a workspace using Intellij").
// 		WithLabel("component", "IDE").
// 		WithLabel("ide", "Intellij").
// 		Assess("it can let JetBrains Gateway connect", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
// 			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
// 			defer cancel()
// 			JetBrainsIDETest(ctx, t, cfg, "intellij", "https://github.com/gitpod-samples/spring-petclinic")
// 			return ctx
// 		}).
// 		Feature()
// 	testEnv.Test(t, f)
// }

// func TestPhpStorm(t *testing.T) {
// 	integration.SkipWithoutUsername(t, username)
// 	integration.SkipWithoutUserToken(t, userToken)
// 	if roboquatToken == "" {
// 		t.Fatal("this test need github action run permission")
// 	}
// 	f := features.New("Start a workspace using PhpStorm").
// 		WithLabel("component", "IDE").
// 		WithLabel("ide", "PhpStorm").
// 		Assess("it can let JetBrains Gateway connect", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
// 			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
// 			defer cancel()
// 			JetBrainsIDETest(ctx, t, cfg, "phpstorm", "https://github.com/gitpod-samples/template-php-laravel-mysql")
// 			return ctx
// 		}).
// 		Feature()
// 	testEnv.Test(t, f)
// }

// func TestPyCharm(t *testing.T) {
// 	integration.SkipWithoutUsername(t, username)
// 	integration.SkipWithoutUserToken(t, userToken)
// 	if roboquatToken == "" {
// 		t.Fatal("this test need github action run permission")
// 	}
// 	f := features.New("Start a workspace using Pycharm").
// 		WithLabel("component", "IDE").
// 		WithLabel("ide", "Pycharm").
// 		Assess("it can let JetBrains Gateway connect", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
// 			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
// 			defer cancel()
// 			JetBrainsIDETest(ctx, t, cfg, "pycharm", "https://github.com/gitpod-samples/template-python-django")
// 			return ctx
// 		}).
// 		Feature()
// 	testEnv.Test(t, f)
// }

// func TestRubyMine(t *testing.T) {
// 	integration.SkipWithoutUsername(t, username)
// 	integration.SkipWithoutUserToken(t, userToken)
// 	if roboquatToken == "" {
// 		t.Fatal("this test need github action run permission")
// 	}
// 	f := features.New("Start a workspace using RubyMine").
// 		WithLabel("component", "IDE").
// 		WithLabel("ide", "RubyMine").
// 		Assess("it can let JetBrains Gateway connect", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
// 			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
// 			defer cancel()
// 			JetBrainsIDETest(ctx, t, cfg, "rubymine", "https://github.com/gitpod-samples/template-ruby-on-rails-postgres")
// 			return ctx
// 		}).
// 		Feature()
// 	testEnv.Test(t, f)
// }

// func TestWebStorm(t *testing.T) {
// 	integration.SkipWithoutUsername(t, username)
// 	integration.SkipWithoutUserToken(t, userToken)
// 	if roboquatToken == "" {
// 		t.Fatal("this test need github action run permission")
// 	}
// 	f := features.New("Start a workspace using WebStorm").
// 		WithLabel("component", "IDE").
// 		WithLabel("ide", "WebStorm").
// 		Assess("it can let JetBrains Gateway connect", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
// 			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
// 			defer cancel()
// 			JetBrainsIDETest(ctx, t, cfg, "webstorm", "https://github.com/gitpod-samples/template-typescript-react")
// 			return ctx
// 		}).
// 		Feature()
// 	testEnv.Test(t, f)
// }

func TestRider(t *testing.T) {
	if roboquatToken == "" {
		t.Skip("this test need github action run permission")
	}
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)
	f := features.New("Start a workspace using Rider").
		WithLabel("component", "IDE").
		WithLabel("ide", "Rider").
		Assess("it can let JetBrains Gateway connect", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()
			JetBrainsIDETest(ctx, t, cfg, "Rider", "https://github.com/gitpod-samples/template-dotnet-core-cli-csharp")
			return ctx
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
	f := features.New("Start a workspace using CLion").
		WithLabel("component", "IDE").
		WithLabel("ide", "CLion").
		Assess("it can let JetBrains Gateway connect", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()
			JetBrainsIDETest(ctx, t, cfg, "CLion", "https://github.com/gitpod-samples/template-cpp")
			return ctx
		}).
		Feature()
	testEnv.Test(t, f)
}
