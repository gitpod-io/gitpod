// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"testing"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	configv1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	wsmancfg "github.com/gitpod-io/gitpod/ws-manager/api/config"
	"github.com/google/go-cmp/cmp"

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
			Name: "no templates",
			Expectation: Expectation{
				TplConfig: wsmancfg.WorkspacePodTemplateConfiguration{DefaultPath: "/workspace-templates/default.yaml"},
				Data:      map[string]bool{"default.yaml": true},
			},
		},
		{
			Name:   "empty templates",
			Config: &configv1.WorkspaceTemplates{},
			Expectation: Expectation{
				TplConfig: wsmancfg.WorkspacePodTemplateConfiguration{DefaultPath: "/workspace-templates/default.yaml"},
				Data:      map[string]bool{"default.yaml": true},
			},
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
					DefaultPath: "/workspace-templates/default.yaml",
					RegularPath: "/workspace-templates/regular.yaml",
				},
				Data: map[string]bool{
					"default.yaml": true,
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
					DefaultPath:  "/workspace-templates/default.yaml",
					PrebuildPath: "/workspace-templates/prebuild.yaml",
				},
				Data: map[string]bool{
					"default.yaml":  true,
					"prebuild.yaml": true,
				},
			},
		},
		{
			Name: "ghost tpl",
			Config: &configv1.WorkspaceTemplates{
				Ghost: &corev1.Pod{},
			},
			Expectation: Expectation{
				TplConfig: wsmancfg.WorkspacePodTemplateConfiguration{
					DefaultPath: "/workspace-templates/default.yaml",
					GhostPath:   "/workspace-templates/ghost.yaml",
				},
				Data: map[string]bool{
					"default.yaml": true,
					"ghost.yaml":   true,
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
					DefaultPath:    "/workspace-templates/default.yaml",
					ImagebuildPath: "/workspace-templates/imagebuild.yaml",
				},
				Data: map[string]bool{
					"default.yaml":    true,
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
				Workspace:         configv1.Workspace{Templates: test.Config},
			}})
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
