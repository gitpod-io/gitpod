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
	"regexp"
	"strings"
	"testing"
	"time"

	"golang.org/x/oauth2"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
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

func GetHttpContent(url string, ownerToken string) ([]byte, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-gitpod-owner-token", ownerToken)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, err := ioutil.ReadAll(resp.Body)
	return b, err
}

func JetBrainsIDETest(ctx context.Context, t *testing.T, cfg *envconf.Config, ide, productCode, repo string) {
	api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
	t.Cleanup(func() {
		api.Done(t)
	})

	t.Logf("get or create user")
	_, err := api.CreateUser(username, userToken)
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
	var info *protocol.WorkspaceInfo
	var stopWs func(waitForStop bool, api *integration.ComponentAPI) (*wsmanapi.WorkspaceStatus, error)
	useLatest := os.Getenv("TEST_USE_LATEST_VERSION") == "true"
	for i := 0; i < 3; i++ {
		info, stopWs, err = integration.LaunchWorkspaceWithOptions(t, ctx, &integration.LaunchWorkspaceOptions{
			ContextURL: repo,
			IDESettings: &protocol.IDESettings{
				DefaultIde:       ide,
				UseLatestVersion: useLatest,
			},
		}, username, api)
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

	t.Logf("resolve owner token")
	ownerToken, err := server.GetOwnerToken(ctx, info.LatestInstance.WorkspaceID)
	if err != nil {
		t.Fatal(err)
	}

	t.Logf("resolve desktop IDE link")
	gatewayLink, err := resolveDesktopIDELink(info, ide, ownerToken, t)
	if err != nil {
		t.Fatal(err)
	}

	ts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: roboquatToken},
	)
	tc := oauth2.NewClient(ctx, ts)

	githubClient := github.NewClient(tc)

	t.Logf("trigger github action")
	_, err = githubClient.Actions.CreateWorkflowDispatchEventByFileName(ctx, "gitpod-io", "gitpod", "jetbrains-integration-test.yml", github.CreateWorkflowDispatchEventRequest{
		Ref: os.Getenv("TEST_BUILD_REF"),
		Inputs: map[string]interface{}{
			"secret_gateway_link": gatewayLink,
			"secret_access_token": oauthToken,
			"secret_endpoint":     strings.TrimPrefix(info.LatestInstance.IdeURL, "https://"),
			"jb_product":          ide,
			"use_latest":          fmt.Sprintf("%v", useLatest),
			"build_id":            os.Getenv("TEST_BUILD_ID"),
			"build_url":           os.Getenv("TEST_BUILD_URL"),
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	checkUrl := fmt.Sprintf("https://63342-%s/codeWithMe/unattendedHostStatus?token=gitpod", strings.TrimPrefix(info.LatestInstance.IdeURL, "https://"))

	t.Logf("waiting result")
	testStatus := false
	for ctx.Err() == nil {
		time.Sleep(1 * time.Second)
		body, _ := GetHttpContent(checkUrl, ownerToken)
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

	rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(), integration.WithInstanceID(info.LatestInstance.ID), integration.WithWorkspacekitLift(true))
	if err != nil {
		t.Fatal(err)
	}
	defer rsa.Close()
	integration.DeferCloser(t, closer)

	fatalMessages := []string{}

	checkIDEALogs := func() {
		qualifier := ""
		if useLatest {
			qualifier = "-latest"
		}
		jbSystemDir := fmt.Sprintf("/workspace/.cache/JetBrains%s/RemoteDev-%s", qualifier, productCode)
		ideaLogPath := jbSystemDir + "/log/idea.log"

		t.Logf("Check idea.log file correct location %s", ideaLogPath)

		var resp agent.ExecResponse
		err = rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
			Dir:     "/",
			Command: "bash",
			Args: []string{
				"-c",
				fmt.Sprintf("cat %s", ideaLogPath),
			},
		}, &resp)

		t.Logf("checking idea.log")
		if err != nil || resp.ExitCode != 0 {
			t.Fatal("idea.log file not found in the expected location")
		}

		pluginLoadedRegex := regexp.MustCompile(`Loaded custom plugins:.* Gitpod Remote`)
		pluginStartedRegex := regexp.MustCompile(`Gitpod gateway link`)
		pluginIncompatibleRegex := regexp.MustCompile(`Plugin 'Gitpod Remote' .* is not compatible`)

		ideaLogs := []byte(resp.Stdout)
		if pluginLoadedRegex.Match(ideaLogs) {
			t.Logf("backend-plugin loaded")
		} else {
			fatalMessages = append(fatalMessages, "backend-plugin not loaded")
		}
		if pluginStartedRegex.Match(ideaLogs) {
			t.Logf("backend-plugin started")
		} else {
			fatalMessages = append(fatalMessages, "backend-plugin not started")
		}
		if pluginIncompatibleRegex.Match(ideaLogs) {
			fatalMessages = append(fatalMessages, "backend-plugin is incompatible")
		} else {
			t.Logf("backend-plugin maybe compatible")
		}
	}
	checkIDEALogs()

	if len(fatalMessages) > 0 {
		t.Fatalf("[error] tests fail: \n%s", strings.Join(fatalMessages, "\n"))
	}
}

func resolveDesktopIDELink(info *protocol.WorkspaceInfo, ide string, ownerToken string, t *testing.T) (string, error) {
	var (
		ideLink  string
		err      error
		maxTries = 5
	)
	for i := 0; ideLink == "" && i < maxTries; i++ {
		ideLink, err = fetchDekstopIDELink(info, ide, ownerToken)
		if ideLink == "" && i < maxTries-1 {
			t.Logf("failed to fetch IDE link: %v, trying again...", err)
		}
	}
	if ideLink != "" {
		return ideLink, nil
	}
	return "", err
}

func fetchDekstopIDELink(info *protocol.WorkspaceInfo, ide string, ownerToken string) (string, error) {
	body, err := GetHttpContent(fmt.Sprintf("%s/_supervisor/v1/status/ide/wait/true", info.LatestInstance.IdeURL), ownerToken)
	if err != nil {
		return "", fmt.Errorf("failed to fetch IDE status response: %v", err)
	}

	var ideStatus supervisor.IDEStatusResponse
	err = json.Unmarshal(body, &ideStatus)
	if err != nil {
		return "", fmt.Errorf("failed to unmarshal IDE status response: %v, response body: %s", err, body)
	}
	if !ideStatus.GetOk() {
		return "", fmt.Errorf("IDE status is not OK, response body: %s", body)
	}

	desktop := ideStatus.GetDesktop()
	if desktop == nil {
		return "", fmt.Errorf("workspace does not have desktop IDE running, response body: %s", body)
	}
	if desktop.Kind != ide {
		return "", fmt.Errorf("workspace does not have %s running, but %s, response body: %s", ide, desktop.Kind, body)
	}
	if desktop.Link == "" {
		return "", fmt.Errorf("IDE link is empty, response body: %s", body)
	}
	return desktop.Link, nil
}

func TestGoLand(t *testing.T) {
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)
	if roboquatToken == "" {
		t.Fatal("this test need github action run permission")
	}
	f := features.New("Start a workspace using GoLand").
		WithLabel("component", "IDE").
		WithLabel("ide", "GoLand").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()
			JetBrainsIDETest(ctx, t, cfg, "goland", "GO", "https://github.com/gitpod-samples/template-golang-cli")
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}

func TestIntellij(t *testing.T) {
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)
	if roboquatToken == "" {
		t.Fatal("this test need github action run permission")
	}
	f := features.New("Start a workspace using Intellij").
		WithLabel("component", "IDE").
		WithLabel("ide", "Intellij").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()
			JetBrainsIDETest(ctx, t, cfg, "intellij", "IU", "https://github.com/jeanp413/spring-petclinic")
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}

func TestPhpStorm(t *testing.T) {
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)
	if roboquatToken == "" {
		t.Fatal("this test need github action run permission")
	}
	f := features.New("Start a workspace using PhpStorm").
		WithLabel("component", "IDE").
		WithLabel("ide", "PhpStorm").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()
			JetBrainsIDETest(ctx, t, cfg, "phpstorm", "PS", "https://github.com/gitpod-samples/template-php-laravel-mysql")
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}

func TestPyCharm(t *testing.T) {
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)
	if roboquatToken == "" {
		t.Fatal("this test need github action run permission")
	}
	f := features.New("Start a workspace using Pycharm").
		WithLabel("component", "IDE").
		WithLabel("ide", "Pycharm").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()
			JetBrainsIDETest(ctx, t, cfg, "pycharm", "PY", "https://github.com/gitpod-samples/template-python-django")
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}

func TestRubyMine(t *testing.T) {
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)
	if roboquatToken == "" {
		t.Fatal("this test need github action run permission")
	}
	f := features.New("Start a workspace using RubyMine").
		WithLabel("component", "IDE").
		WithLabel("ide", "RubyMine").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()
			// TODO: open comment after https://github.com/gitpod-io/gitpod/issues/16302 resolved
			// JetBrainsIDETest(ctx, t, cfg, "rubymine", "RM", "https://github.com/gitpod-samples/template-ruby-on-rails-postgres")
			JetBrainsIDETest(ctx, t, cfg, "rubymine", "RM", "https://github.com/gitpod-io/Gitpod-Ruby-On-Rails")
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}

func TestWebStorm(t *testing.T) {
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)
	if roboquatToken == "" {
		t.Fatal("this test need github action run permission")
	}
	f := features.New("Start a workspace using WebStorm").
		WithLabel("component", "IDE").
		WithLabel("ide", "WebStorm").
		Assess("it can let JetBrains Gateway connect", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			ctx, cancel := context.WithTimeout(testCtx, 30*time.Minute)
			defer cancel()
			JetBrainsIDETest(ctx, t, cfg, "webstorm", "WS", "https://github.com/gitpod-samples/template-typescript-react")
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
			JetBrainsIDETest(ctx, t, cfg, "rider", "RD", "https://github.com/gitpod-samples/template-dotnet-core-cli-csharp")
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
			JetBrainsIDETest(ctx, t, cfg, "clion", "CL", "https://github.com/gitpod-samples/template-cpp")
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
			JetBrainsIDETest(ctx, t, cfg, "rustrover", "RR", "https://github.com/gitpod-samples/template-rust-cli")
			return testCtx
		}).
		Feature()
	testEnv.Test(t, f)
}
