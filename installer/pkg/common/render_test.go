// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common_test

import (
	"testing"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1alpha1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"github.com/google/go-cmp/cmp"

	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestDependencySortingRenderFunc(t *testing.T) {
	tests := []struct {
		Name        string
		Input       common.RenderFunc
		Expectation []string
	}{
		{
			Name: "single component",
			Input: func(cfg *common.RenderContext) ([]runtime.Object, error) {
				return []runtime.Object{
					&corev1.Pod{TypeMeta: common.TypeMetaPod},
					&corev1.ServiceAccount{TypeMeta: common.TypeMetaServiceAccount},
					&rbacv1.ClusterRole{TypeMeta: common.TypeMetaClusterRole},
				}, nil
			},
			Expectation: []string{
				common.TypeMetaClusterRole.GroupVersionKind().String(),
				common.TypeMetaServiceAccount.GroupVersionKind().String(),
				common.TypeMetaPod.GroupVersionKind().String(),
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			ctx := &common.RenderContext{
				Config:          *config.LoadMock(),
				VersionManifest: versions.Manifest{},
			}
			objs, err := common.DependencySortingRenderFunc(test.Input)(ctx)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			var act []string
			for _, o := range objs {
				act = append(act, o.GetObjectKind().GroupVersionKind().String())
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("DependencySortingRenderFunc() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
