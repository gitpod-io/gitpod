// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"fmt"
	"net/rpc"
	"strings"
	"testing"
	"time"

	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	agent "github.com/gitpod-io/gitpod/test/pkg/agent/workspace/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	corev1 "k8s.io/api/core/v1"
)

const (
	SECRET_NAME  = "USER_SECRET"
	SECRET_VALUE = "a9upr238"
)

func TestProtectedSecrets(t *testing.T) {
	f := features.New("protected_secrets").WithLabel("component", "ws-manager").Assess("can use protected secrets", func(_ context.Context, t *testing.T, cfg *envconf.Config) context.Context {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
		t.Cleanup(func() {
			api.Done(t)
		})

		swr := func(req *wsmanapi.StartWorkspaceRequest) error {
			req.Spec.Envvars = []*wsmanapi.EnvironmentVariable{
				{
					Name:  SECRET_NAME,
					Value: SECRET_VALUE,
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

			req.Spec.WorkspaceLocation = "empty"
			return nil
		}

		ws, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(swr))
		if err != nil {
			t.Fatalf("cannot launch a workspace: %q", err)
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

		k8sClient := cfg.Client()
		var wsPod corev1.Pod
		if err := k8sClient.Resources().Get(context.Background(), "ws-"+ws.Req.Id, cfg.Namespace(), &wsPod); err != nil {
			t.Fatal(err)
		}

		assertEnvSuppliedBySecret(t, &wsPod, SECRET_NAME)

		rsa, closer, err := integration.Instrument(integration.ComponentWorkspace, "workspace", cfg.Namespace(), kubeconfig, cfg.Client(),
			integration.WithInstanceID(ws.Req.Id),
			integration.WithContainer("workspace"),
			integration.WithWorkspacekitLift(true),
		)
		if err != nil {
			t.Fatal(err)
		}

		assertEnvAvailableInWs(t, rsa)

		integration.DeferCloser(t, closer)
		defer rsa.Close()

		return ctx
	}).Feature()

	testEnv.Test(t, f)
}

func assertEnvSuppliedBySecret(t *testing.T, wsPod *corev1.Pod, secretEnv string) {
	for _, c := range wsPod.Spec.Containers {
		if c.Name != "workspace" {
			continue
		}

		for _, env := range c.Env {
			if env.Name == secretEnv {
				if env.Value != "" {
					t.Fatalf("environment variable has plain text value")
				}

				if env.ValueFrom == nil || env.ValueFrom.SecretKeyRef == nil {
					t.Fatalf("environment variable value is not supplied by secret")
				}

				if env.ValueFrom.SecretKeyRef.Name != wsPod.Name {
					t.Fatalf("expected environment variable values are not supplied by secret %s", wsPod.Name)
				}
			}
		}
	}
}

func assertEnvAvailableInWs(t *testing.T, rsa *rpc.Client) {
	var grepResp agent.ExecResponse
	err := rsa.Call("WorkspaceAgent.Exec", &agent.ExecRequest{
		Dir:     prebuildLogPath,
		Command: "bash",
		Args: []string{
			"-c",
			fmt.Sprintf("env | grep %s", SECRET_NAME),
		},
	}, &grepResp)

	if err != nil {
		t.Fatal(err)
	}

	expected := fmt.Sprintf("%s=%s", SECRET_NAME, SECRET_VALUE)
	if strings.TrimSpace(grepResp.Stdout) != expected {
		t.Fatalf("expected environment variable to be %s, but was %s", expected, grepResp.Stdout)
	}
}
