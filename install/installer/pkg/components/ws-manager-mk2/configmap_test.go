// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanagermk2

import (
	"encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/utils/pointer"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	wsmancfg "github.com/gitpod-io/gitpod/ws-manager/api/config"
)

func TestBuildWorkspaceTemplates(t *testing.T) {
	type Expectation struct {
		TplConfig wsmancfg.WorkspacePodTemplateConfiguration
		Data      map[string]bool
	}
	tests := []struct {
		Name              string
		ClassName         string
		Config            *config.WorkspaceTemplates
		ContainerRegistry *config.ContainerRegistry
		Expectation       Expectation
	}{
		{
			Name:        "no templates",
			ClassName:   "",
			Expectation: Expectation{},
		},
		{
			Name:        "empty templates",
			ClassName:   "",
			Config:      &config.WorkspaceTemplates{},
			Expectation: Expectation{},
		},
		{
			Name:      "default tpl",
			ClassName: "",
			Config: &config.WorkspaceTemplates{
				Default: &corev1.Pod{},
			},
			Expectation: Expectation{
				TplConfig: wsmancfg.WorkspacePodTemplateConfiguration{DefaultPath: "/workspace-templates/default.yaml"},
				Data:      map[string]bool{"default.yaml": true},
			},
		},
		{
			Name:      "regular tpl",
			ClassName: "",
			Config: &config.WorkspaceTemplates{
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
			Name:      "prebuild tpl",
			ClassName: "",
			Config: &config.WorkspaceTemplates{
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
			Name:      "imgbuild tpl",
			ClassName: "",
			Config: &config.WorkspaceTemplates{
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
		{
			Name:      "regular class tpl",
			ClassName: "awesome-class",
			Config: &config.WorkspaceTemplates{
				Regular: &corev1.Pod{},
			},
			Expectation: Expectation{
				TplConfig: wsmancfg.WorkspacePodTemplateConfiguration{
					RegularPath: "/workspace-templates/awesome-class-regular.yaml",
				},
				Data: map[string]bool{
					"awesome-class-regular.yaml": true,
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var (
				act  Expectation
				tpls map[string]string
				err  error
			)

			if test.ContainerRegistry == nil {
				test.ContainerRegistry = &config.ContainerRegistry{InCluster: pointer.Bool(true)}
			}

			act.TplConfig, tpls, err = buildWorkspaceTemplates(&common.RenderContext{Config: config.Config{
				ContainerRegistry: *test.ContainerRegistry,
			}}, test.Config, test.ClassName)
			if err != nil {
				t.Error(err)
			}

			if len(tpls) > 0 {
				dt := make(map[string]bool)
				for k := range tpls {
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
		{
			Name:                             "With old default installation shortname for existing self-hosted installations",
			Domain:                           "example.com",
			InstallationShortname:            config.InstallationShortNameOldDefault,
			ExpectedWorkspaceUrlTemplate:     "https://{{ .Prefix }}.ws.example.com",
			ExpectedWorkspacePortURLTemplate: "https://{{ .WorkspacePort }}-{{ .Prefix }}.ws.example.com",
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			ctx, err := common.NewRenderContext(config.Config{
				Domain: test.Domain,
				Metadata: config.Metadata{
					InstallationShortname: test.InstallationShortname,
				},
				ObjectStorage: config.ObjectStorage{
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
