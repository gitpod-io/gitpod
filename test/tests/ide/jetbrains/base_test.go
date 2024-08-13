// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package ide

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"golang.org/x/oauth2"
	"sigs.k8s.io/e2e-framework/pkg/envconf"

	protocol "github.com/gitpod-io/gitpod/gitpod-protocol"
	supervisor "github.com/gitpod-io/gitpod/supervisor/api"
	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/google/go-github/v42/github"
)

var testBaseConfig = map[string]struct{ ProductCode, Repo string }{
	"goland":   {"GO", "https://github.com/gitpod-samples/template-golang-cli"},
	"intellij": {"IU", "https://github.com/jeanp413/spring-petclinic"},
	"phpstorm": {"PS", "https://github.com/gitpod-samples/template-php-laravel-mysql"},
	"pycharm":  {"PY", "https://github.com/gitpod-samples/template-python-django"},
	// TODO: open comment after https://github.com/gitpod-io/gitpod/issues/16302 resolved
	// "rubymine":  {"RM", "https://github.com/gitpod-samples/template-ruby-on-rails-postgres"},
	"rubymine":  {"RM", "https://github.com/gitpod-io/Gitpod-Ruby-On-Rails"},
	"webstorm":  {"WS", "https://github.com/gitpod-samples/template-typescript-react"},
	"rider":     {"RD", "https://github.com/gitpod-samples/template-dotnet-core-cli-csharp"},
	"clion":     {"CL", "https://github.com/gitpod-samples/template-cpp"},
	"rustrover": {"RR", "https://github.com/gitpod-samples/template-rust-cli"},
}

var (
	userToken     string
	roboquatToken string
)

func init() {
	userToken, _ = os.LookupEnv("USER_TOKEN")
	roboquatToken, _ = os.LookupEnv("ROBOQUAT_TOKEN")
}

type JetBrainsIDETestOpts struct {
	IDE                  string
	ProductCode          string
	Repo                 string
	AdditionalRpcCalls   []func(rsa *integration.RpcClient, jbCtx *JetBrainsTestCtx) error
	BeforeWorkspaceStart func(userID string) error
	RepositoryID         string
}

type JetBrainsIDETestOpt func(*JetBrainsIDETestOpts) error

func WithAdditionRpcCall(f func(rsa *integration.RpcClient, jbCtx *JetBrainsTestCtx) error) JetBrainsIDETestOpt {
	return func(o *JetBrainsIDETestOpts) error {
		o.AdditionalRpcCalls = append(o.AdditionalRpcCalls, f)
		return nil
	}
}

func WithIDE(ide string) JetBrainsIDETestOpt {
	return func(o *JetBrainsIDETestOpts) error {
		o.IDE = ide
		if t, ok := testBaseConfig[ide]; ok {
			o.ProductCode = t.ProductCode
			if o.Repo == "" {
				o.Repo = t.Repo
			}
		}
		return nil
	}
}

func WithRepo(repo string) JetBrainsIDETestOpt {
	return func(o *JetBrainsIDETestOpts) error {
		o.Repo = repo
		return nil
	}
}

func WithRepositoryID(repoID string) JetBrainsIDETestOpt {
	return func(o *JetBrainsIDETestOpts) error {
		o.RepositoryID = repoID
		return nil
	}
}

func BaseGuard(t *testing.T) {
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)
	if roboquatToken == "" {
		t.Fatal("this test need github action run permission")
	}
}

func JetBrainsIDETest(ctx context.Context, t *testing.T, cfg *envconf.Config, opts ...JetBrainsIDETestOpt) {
	BaseGuard(t)
	option := &JetBrainsIDETestOpts{}
	for _, o := range opts {
		if err := o(option); err != nil {
			t.Fatal(err)
		}
	}

	api, server, _, _ := MustConnectToServer(ctx, t, cfg)
	var err error

	t.Logf("starting workspace")
	var info *protocol.WorkspaceInfo
	var stopWs func(waitForStop bool, api *integration.ComponentAPI) (*wsmanapi.WorkspaceStatus, error)
	useLatest := os.Getenv("TEST_USE_LATEST_VERSION") == "true"
	for i := 0; i < 3; i++ {
		info, stopWs, err = integration.LaunchWorkspaceWithOptions(t, ctx, &integration.LaunchWorkspaceOptions{
			ContextURL: option.Repo,
			ProjectID:  option.RepositoryID,
			IDESettings: &protocol.IDESettings{
				DefaultIde:       option.IDE,
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
	gatewayLink, err := resolveDesktopIDELink(info, option.IDE, ownerToken, t)
	if err != nil {
		t.Fatal(err)
	}

	ts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: roboquatToken},
	)
	tc := oauth2.NewClient(ctx, ts)

	githubClient := github.NewClient(tc)

	if os.Getenv("TEST_IN_WORKSPACE") == "true" {
		t.Logf("run test in workspace")
		go testWithoutGithubAction(ctx, gatewayLink, oauthToken, strings.TrimPrefix(info.LatestInstance.IdeURL, "https://"), useLatest)
	} else {
		t.Logf("trigger github action")
		// Note: For manually trigger github action purpose
		// t.Logf("secret_gateway_link %s\nsecret_access_token %s\nsecret_endpoint %s\njb_product %s\nuse_latest %v\nbuild_id %s\nbuild_url %s", gatewayLink, oauthToken, strings.TrimPrefix(info.LatestInstance.IdeURL, "https://"), option.IDE, useLatest, os.Getenv("TEST_BUILD_ID"), os.Getenv("TEST_BUILD_URL"))
		// time.Sleep(30 * time.Minute)
		_, err = githubClient.Actions.CreateWorkflowDispatchEventByFileName(ctx, "gitpod-io", "gitpod", "jetbrains-integration-test.yml", github.CreateWorkflowDispatchEventRequest{
			Ref: os.Getenv("TEST_BUILD_REF"),
			Inputs: map[string]interface{}{
				"secret_gateway_link": gatewayLink,
				"secret_access_token": oauthToken,
				"secret_endpoint":     strings.TrimPrefix(info.LatestInstance.IdeURL, "https://"),
				"jb_product":          option.IDE,
				"use_latest":          fmt.Sprintf("%v", useLatest),
				"build_id":            os.Getenv("TEST_BUILD_ID"),
				"build_url":           os.Getenv("TEST_BUILD_URL"),
			},
		})
		if err != nil {
			t.Fatal(err)
		}
	}

	checkUrl := fmt.Sprintf("https://63342-%s/codeWithMe/unattendedHostStatus?token=gitpod", strings.TrimPrefix(info.LatestInstance.IdeURL, "https://"))

	t.Logf("waiting result")
	testStatus := false
	for ctx.Err() == nil {
		time.Sleep(1 * time.Second)
		body, _ := getHttpContent(checkUrl, ownerToken)
		var status gatewayHostStatus
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
		jbSystemDir := fmt.Sprintf("/workspace/.cache/JetBrains%s/RemoteDev-%s", qualifier, option.ProductCode)
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

		pluginLoadedRegex := regexp.MustCompile(`Loaded custom plugins:.* (Gitpod Remote|gitpod-remote)`)
		pluginStartedRegex := regexp.MustCompile(`Gitpod gateway link`)
		pluginIncompatibleRegex := regexp.MustCompile(`Plugin '(Gitpod Remote|gitpod-remote)' .* is not compatible`)

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

		for _, fn := range option.AdditionalRpcCalls {
			if err := fn(rsa, &JetBrainsTestCtx{
				SystemDir: jbSystemDir,
			}); err != nil {
				fatalMessages = append(fatalMessages, fmt.Sprintf("additional agent exec failed: %v", err))
			}
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
	body, err := getHttpContent(fmt.Sprintf("%s/_supervisor/v1/status/ide/wait/true", info.LatestInstance.IdeURL), ownerToken)
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

func getHttpContent(url string, ownerToken string) ([]byte, error) {
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
	b, err := io.ReadAll(resp.Body)
	return b, err
}

type gatewayHostStatus struct {
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

type JetBrainsTestCtx struct {
	UserID    string
	SystemDir string
}

func MustConnectToServer(ctx context.Context, t *testing.T, cfg *envconf.Config) (*integration.ComponentAPI, protocol.APIInterface, *integration.PAPIClient, string) {
	t.Logf("connected to server")
	api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
	t.Cleanup(func() {
		api.Done(t)
	})
	t.Logf("get or create user")
	userID, err := api.CreateUser(username, userToken)
	if err != nil {
		t.Fatal(err)
	}

	t.Logf("connecting to server...")
	server, err := api.GitpodServer(integration.WithGitpodUser(username))
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("connecting to papi...")
	papi, err := api.PublicApi(integration.WithGitpodUser(username))
	if err != nil {
		t.Fatal(err)
	}
	return api, server, papi, userID
}
