// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"encoding/json"
	"testing"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	configv1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	wsmancfg "github.com/gitpod-io/gitpod/ws-manager/api/config"
	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func TestBuildWorkspaceTemplates(t *testing.T) {
	type Expectation struct {
		TplConfig wsmancfg.WorkspacePodTemplateConfiguration
		Data      map[string]bool
	}
	tests := []struct {
		Name              string
		Config            *configv1.WorkspaceTemplates
		ContainerRegistry *configv1.ContainerRegistry
		Expectation       Expectation
	}{
		{
			Name:        "no templates",
			Expectation: Expectation{},
		},
		{
			Name:        "empty templates",
			Config:      &configv1.WorkspaceTemplates{},
			Expectation: Expectation{},
		},
		{
			Name: "default tpl",
			Config: &configv1.WorkspaceTemplates{
				Default: &corev1.Pod{},
			},
			Expectation: Expectation{
				TplConfig: wsmancfg.WorkspacePodTemplateConfiguration{DefaultPath: "/workspace-templates/default.yaml"},
				Data:      map[string]bool{"default.yaml": true},
			},
		},
		{
			Name: "regular tpl",
			Config: &configv1.WorkspaceTemplates{
				Regular: &corev1.Pod{},
			},
			Expectation: Expectation{
				TplConfig: wsmancfg.WorkspacePodTemplateConfiguration{
					RegularPath: "/workspace-templates/regular.yaml",
				},
				Data: map[string]bool{
					"regular.yaml": true,
				},
			},
		},
		{
			Name: "prebuild tpl",
			Config: &configv1.WorkspaceTemplates{
				Prebuild: &corev1.Pod{},
			},
			Expectation: Expectation{
				TplConfig: wsmancfg.WorkspacePodTemplateConfiguration{
					PrebuildPath: "/workspace-templates/prebuild.yaml",
				},
				Data: map[string]bool{
					"prebuild.yaml": true,
				},
			},
		},
		{
			Name: "imgbuild tpl",
			Config: &configv1.WorkspaceTemplates{
				ImageBuild: &corev1.Pod{},
			},
			Expectation: Expectation{
				TplConfig: wsmancfg.WorkspacePodTemplateConfiguration{
					ImagebuildPath: "/workspace-templates/imagebuild.yaml",
				},
				Data: map[string]bool{
					"imagebuild.yaml": true,
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var (
				act  Expectation
				objs []runtime.Object
				err  error
			)

			if test.ContainerRegistry == nil {
				test.ContainerRegistry = &configv1.ContainerRegistry{InCluster: pointer.Bool(true)}
			}

			act.TplConfig, objs, err = buildWorkspaceTemplates(&common.RenderContext{Config: configv1.Config{
				ContainerRegistry: *test.ContainerRegistry,
			}}, test.Config, "")
			if err != nil {
				t.Error(err)
			}
			if len(objs) < 1 {
				t.Fatalf("received zero runtime objects")
				return
			}

			cfgmap, ok := objs[0].(*corev1.ConfigMap)
			if !ok {
				t.Fatalf("buildWorkspaceTemplates did not return a configMap")
				return
			}
			if len(cfgmap.Data) > 0 {
				dt := make(map[string]bool)
				for k := range cfgmap.Data {
					dt[k] = true
				}
				act.Data = dt
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("Expectation mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestWorkspaceURLTemplates(t *testing.T) {
	tests := []struct {
		Name                             string
		Domain                           string
		InstallationShortname            string
		ExpectedWorkspaceUrlTemplate     string
		ExpectedWorkspacePortURLTemplate string
	}{
		{
			Name:                             "With an installation shortname",
			Domain:                           "example.com",
			InstallationShortname:            "eu02",
			ExpectedWorkspaceUrlTemplate:     "https://{{ .Prefix }}.ws-eu02.example.com",
			ExpectedWorkspacePortURLTemplate: "https://{{ .WorkspacePort }}-{{ .Prefix }}.ws-eu02.example.com",
		},
		{
			Name:                             "Without an installation shortname",
			Domain:                           "example.com",
			InstallationShortname:            "",
			ExpectedWorkspaceUrlTemplate:     "https://{{ .Prefix }}.ws.example.com",
			ExpectedWorkspacePortURLTemplate: "https://{{ .WorkspacePort }}-{{ .Prefix }}.ws.example.com",
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			ctx, err := common.NewRenderContext(config.Config{
				Domain: test.Domain,
				Metadata: configv1.Metadata{
					InstallationShortname: test.InstallationShortname,
				},
				ObjectStorage: configv1.ObjectStorage{
					InCluster: pointer.Bool(true),
				},
			}, versions.Manifest{}, "test_namespace")
			require.NoError(t, err)

			objs, err := configmap(ctx)
			require.NoError(t, err)

			cfgmap, ok := objs[0].(*corev1.ConfigMap)
			require.Truef(t, ok, "configmap function did not return a configmap")

			configJson, ok := cfgmap.Data["config.json"]
			require.Truef(t, ok, "configmap data did not contain %q key", "config.json")

			serviceConfig := wsmancfg.ServiceConfiguration{}
			json.Unmarshal([]byte(configJson), &serviceConfig)

			require.Equal(t, test.ExpectedWorkspaceUrlTemplate, serviceConfig.Manager.WorkspaceURLTemplate)
			require.Equal(t, test.ExpectedWorkspacePortURLTemplate, serviceConfig.Manager.WorkspacePortURLTemplate)
		})
	}
}
