// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package controllers

import (
	"testing"

	"github.com/gitpod-io/gitpod/ws-manager/api/config"
	v1 "github.com/gitpod-io/gitpod/ws-manager/api/crd/v1"
	"github.com/google/go-cmp/cmp"
	corev1 "k8s.io/api/core/v1"
)

func TestCreateWorkspaceEnvironment(t *testing.T) {
	type Expectation struct {
		Error string
		Vars  []corev1.EnvVar
	}
	tests := []struct {
		Name        string
		Expectation Expectation
		Context     *startWorkspaceContext
	}{
		{
			Name: "with Git config",
			Context: &startWorkspaceContext{
				Config: &config.Configuration{
					WorkspaceClasses: map[string]*config.WorkspaceClass{
						"default": {Name: "default"},
					},
				},
				Workspace: &v1.Workspace{
					Spec: v1.WorkspaceSpec{
						Class: "default",
						Git: &v1.GitSpec{
							Username: "foobar",
							Email:    "foo@bar.com",
						},
					},
				},
			},
			Expectation: Expectation{
				Vars: []corev1.EnvVar{
					{Name: "GITPOD_REPO_ROOT", Value: "/workspace"},
					{Name: "GITPOD_REPO_ROOTS", Value: "/workspace"},
					{Name: "GITPOD_THEIA_PORT", Value: "0"},
					{Name: "THEIA_WORKSPACE_ROOT", Value: "/workspace"},
					{Name: "GITPOD_WORKSPACE_CLASS", Value: "default"},
					{Name: "THEIA_SUPERVISOR_ENDPOINT", Value: ":0"},
					{Name: "THEIA_WEBVIEW_EXTERNAL_ENDPOINT", Value: "webview-{{hostname}}"},
					{Name: "THEIA_MINI_BROWSER_HOST_PATTERN", Value: "browser-{{hostname}}"},
					{Name: "GITPOD_GIT_USER_NAME", Value: "foobar"},
					{Name: "GITPOD_GIT_USER_EMAIL", Value: "foo@bar.com"},
					{Name: "GITPOD_INTERVAL", Value: "0"}, {Name: "GITPOD_MEMORY", Value: "0"}, {Name: "GITPOD_CPU_COUNT", Value: "0"},
				},
			},
		},
		{
			Name: "without Git config",
			Context: &startWorkspaceContext{
				Config: &config.Configuration{
					WorkspaceClasses: map[string]*config.WorkspaceClass{
						"default": {Name: "default"},
					},
				},
				Workspace: &v1.Workspace{
					Spec: v1.WorkspaceSpec{
						Class: "default",
					},
				},
			},
			Expectation: Expectation{
				Vars: []corev1.EnvVar{
					{Name: "GITPOD_REPO_ROOT", Value: "/workspace"},
					{Name: "GITPOD_REPO_ROOTS", Value: "/workspace"},
					{Name: "GITPOD_THEIA_PORT", Value: "0"},
					{Name: "THEIA_WORKSPACE_ROOT", Value: "/workspace"},
					{Name: "GITPOD_WORKSPACE_CLASS", Value: "default"},
					{Name: "THEIA_SUPERVISOR_ENDPOINT", Value: ":0"},
					{Name: "THEIA_WEBVIEW_EXTERNAL_ENDPOINT", Value: "webview-{{hostname}}"},
					{Name: "THEIA_MINI_BROWSER_HOST_PATTERN", Value: "browser-{{hostname}}"},
					{Name: "GITPOD_INTERVAL", Value: "0"}, {Name: "GITPOD_MEMORY", Value: "0"}, {Name: "GITPOD_CPU_COUNT", Value: "0"},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var act Expectation

			res, err := createWorkspaceEnvironment(test.Context)
			if err != nil {
				act.Error = err.Error()
			}
			act.Vars = res

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("createWorkspaceEnvironment() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
