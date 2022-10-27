// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"encoding/json"
	"fmt"
	"net/rpc"
	"os"
	"strings"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	"sigs.k8s.io/e2e-framework/klient"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
)

func TestDotfiles(t *testing.T) {
	userToken, _ := os.LookupEnv("USER_TOKEN")
	integration.SkipWithoutUsername(t, username)
	integration.SkipWithoutUserToken(t, userToken)

	f := features.New("dotfiles").WithLabel("component", "ws-manager").Assess("ensure dotfiles are loaded", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
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

		tokenId, err := api.CreateOAuth2Token(username, []string{
			"function:getToken",
			"function:openPort",
			"function:getOpenPorts",
			"function:guessGitTokenScopes",
			"function:getWorkspace",
			"resource:token::*::get",
		})
		if err != nil {
			t.Fatal(err)
		}

		swr := func(req *wsmanapi.StartWorkspaceRequest) error {
			req.Spec.Envvars = []*wsmanapi.EnvironmentVariable{
				{
					Name:  "SUPERVISOR_DOTFILE_REPO",
					Value: "https://github.com/gitpod-io/test-dotfiles-support",
				},
				{
					Name: "THEIA_SUPERVISOR_TOKENS",
					Value: fmt.Sprintf(`[{
						"token": "%v",
						"kind": "gitpod",
						"host": "%v",
						"scope": ["function:getToken", "function:openPort", "function:getOpenPorts", "function:guessGitTokenScopes", "getWorkspace", "resource:token::*::get"],
						"expiryDate": "2022-10-26T10:38:05.232Z",
						"reuse": 4
					}]`, tokenId, getHostUrl(ctx, t, cfg.Client())),
				},
			}

			req.Spec.Initializer = &csapi.WorkspaceInitializer{
				Spec: &csapi.WorkspaceInitializer_Git{
					Git: &csapi.GitInitializer{
						RemoteUri:        "https://github.com/gitpod-io/empty",
						CheckoutLocation: "empty",
						Config:           &csapi.GitConfig{},
					},
				},
			}

			req.Metadata.Owner = userId
			req.Spec.WorkspaceLocation = "empty"
			return nil
		}

		ws, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(swr))
		if err != nil {
			t.Fatal(err)
		}

		defer func() {
			sctx, scancel := context.WithTimeout(context.Background(), 5*time.Minute)
			defer scancel()

			sapi := integration.NewComponentAPI(sctx, cfg.Namespace(), kubeconfig, cfg.Client())
			defer sapi.Done(t)

			_, err = stopWs(true, sapi)
			if err != nil {
				t.Errorf("cannot stop workspace: %q", err)
			}
		}()

		rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(),
			integration.WithInstanceID(ws.Req.Id),
			integration.WithContainer("workspace"),
			integration.WithWorkspacekitLift(true),
		)
		if err != nil {
			t.Fatal(err)
		}

		integration.DeferCloser(t, closer)
		defer rsa.Close()

		assertDotfiles(t, rsa)

		return ctx
	}).Feature()

	testEnv.Test(t, f)
}

func getHostUrl(ctx context.Context, t *testing.T, k8sClient klient.Client) string {
	var configmap corev1.ConfigMap
	if err := k8sClient.Resources().Get(ctx, "server-config", "default", &configmap); err != nil {
		t.Fatal(err)
	}

	config, ok := configmap.Data["config.json"]
	if !ok {
		t.Fatal("server config map does not contain config.json")
	}

	c := make(map[string]json.RawMessage)
	if err := json.Unmarshal([]byte(config), &c); err != nil {
		t.Fatal(err)
	}

	hostUrlRaw, ok := c["hostUrl"]
	if !ok {
		t.Fatal("server config map does not contain host url")
	}

	return strings.TrimPrefix(strings.Trim(string(hostUrlRaw), "\""), "https://")
}

func assertDotfiles(t *testing.T, rsa *rpc.Client) error {
	var ls agent.ListDirResponse
	err := rsa.Call("WorkspaceAgent.ListDir", &agent.ListDirRequest{
		Dir: "/home/gitpod/.dotfiles",
	}, &ls)

	if err != nil {
		t.Fatal(err)
	}

	dotfiles := map[string]bool{
		"bash_aliases": false,
		"git":          false,
	}

	for _, dir := range ls.Files {
		delete(dotfiles, dir)
	}

	if len(dotfiles) > 0 {
		t.Fatalf("dotfiles were not installed successfully: %+v", dotfiles)
	}

	return nil
}
