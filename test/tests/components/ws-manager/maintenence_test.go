// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsmanager

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/e2e-framework/klient"
	"sigs.k8s.io/e2e-framework/pkg/envconf"
	"sigs.k8s.io/e2e-framework/pkg/features"

	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/test/pkg/integration"
	wsmanapi "github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/gitpod-io/gitpod/ws-manager/api/config"
)

func TestMaintenance(t *testing.T) {
	testRepo := "https://github.com/gitpod-io/empty"
	testRepoName := "empty"

	f1 := features.New("maintenance").
		WithLabel("component", "ws-manager").
		WithLabel("type", "maintenance").
		Assess("should display maintenance message", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			kubeClient, err := cfg.NewClient()
			if err != nil {
				t.Fatal(err)
			}

			untilTime := time.Now().Add(1 * time.Hour)
			err = configureMaintenanceMode(testCtx, &untilTime, kubeClient)
			if err != nil {
				t.Fatal(err)
			}

			t.Cleanup(func() {
				err = configureMaintenanceMode(testCtx, nil, kubeClient)
				if err != nil {
					t.Error(err)
				}
			})

			ctx, cancel := context.WithTimeout(testCtx, time.Duration(5*time.Minute))
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			customizeWorkspace := func(swr *wsmanapi.StartWorkspaceRequest) error {
				swr.Spec.Initializer = &csapi.WorkspaceInitializer{
					Spec: &csapi.WorkspaceInitializer_Git{
						Git: &csapi.GitInitializer{
							RemoteUri:        testRepo,
							CheckoutLocation: testRepoName,
							Config:           &csapi.GitConfig{},
						},
					},
				}
				swr.Spec.WorkspaceLocation = testRepoName
				return nil
			}

			_, _, err = integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(customizeWorkspace))
			if err == nil {
				t.Fatalf("expected under maintenance error")
			} else {
				if !errors.Is(err, status.Error(codes.FailedPrecondition, "under maintenance")) {
					t.Fatal(err)
				}
			}

			return testCtx
		}).
		Feature()

	f2 := features.New("maintenance-configuration").
		WithLabel("component", "ws-manager").
		WithLabel("type", "maintenance").
		Assess("should display a maintenance message when configured and not when disabled", func(testCtx context.Context, t *testing.T, cfg *envconf.Config) context.Context {
			kubeClient, err := cfg.NewClient()
			if err != nil {
				t.Fatal(err)
			}

			untilTime := time.Now().Add(1 * time.Hour)
			err = configureMaintenanceMode(testCtx, &untilTime, kubeClient)
			if err != nil {
				t.Fatal(err)
			}

			ctx, cancel := context.WithTimeout(testCtx, time.Duration(5*time.Minute))
			defer cancel()

			api := integration.NewComponentAPI(ctx, cfg.Namespace(), kubeconfig, cfg.Client())
			t.Cleanup(func() {
				api.Done(t)
			})

			_, _, err = integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(func(swr *wsmanapi.StartWorkspaceRequest) error {
				swr.Spec.Initializer = &csapi.WorkspaceInitializer{
					Spec: &csapi.WorkspaceInitializer_Git{
						Git: &csapi.GitInitializer{
							RemoteUri:        testRepo,
							CheckoutLocation: testRepoName,
							Config:           &csapi.GitConfig{},
						},
					},
				}
				swr.Spec.WorkspaceLocation = testRepoName
				return nil
			}))
			if err == nil {
				t.Fatalf("expected under maintenance error")
			} else {
				if !errors.Is(err, status.Error(codes.FailedPrecondition, "under maintenance")) {
					t.Fatal(err)
				}
			}

			err = configureMaintenanceMode(testCtx, nil, kubeClient)
			if err != nil {
				t.Fatal(err)
			}

			_, stopWs, err := integration.LaunchWorkspaceDirectly(t, ctx, api, integration.WithRequestModifier(func(swr *wsmanapi.StartWorkspaceRequest) error {
				swr.Spec.Initializer = &csapi.WorkspaceInitializer{
					Spec: &csapi.WorkspaceInitializer_Git{
						Git: &csapi.GitInitializer{
							RemoteUri:        testRepo,
							CheckoutLocation: testRepoName,
							Config:           &csapi.GitConfig{},
						},
					},
				}
				swr.Spec.WorkspaceLocation = testRepoName
				return nil
			}))
			if err != nil {
				t.Fatal(err)
			}

			if err := stopWorkspace(t, cfg, stopWs); err != nil {
				t.Errorf("cannot stop workspace: %q", err)
			}

			return testCtx
		}).
		Feature()

	testEnv.Test(t, f1, f2)
}

func configureMaintenanceMode(ctx context.Context, untilTime *time.Time, kubeClient klient.Client) error {
	cmap, err := maintenanceConfigmap(untilTime)
	if err != nil {
		return err
	}

	err = kubeClient.Resources().Create(ctx, cmap)
	if err != nil {
		if apierrors.IsAlreadyExists(err) {
			err = kubeClient.Resources().Update(ctx, cmap)
			if err != nil {
				return err
			}
		}

		return err
	}

	return nil
}

func maintenanceConfigmap(untilTime *time.Time) (*corev1.ConfigMap, error) {
	mcfg := config.MaintenanceConfig{}
	if untilTime != nil {
		mcfg.EnabledUntil = untilTime
	}

	data, err := json.Marshal(mcfg)
	if err != nil {
		return nil, err
	}

	return &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "ws-manager-mk2-maintenance-mode",
			Namespace: "default",
		},
		Data: map[string]string{
			"config.json": string(data),
		},
	}, nil
}
