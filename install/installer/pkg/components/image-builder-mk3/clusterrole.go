// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package image_builder_mk3

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func clusterrole(ctx *common.RenderContext) ([]runtime.Object, error) {
	var resources []runtime.Object

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.Common != nil && cfg.Common.UsePodSecurityPolicies {
			resources = append(resources, &rbacv1.ClusterRole{
				TypeMeta: common.TypeMetaClusterRole,
				ObjectMeta: metav1.ObjectMeta{
					Name:   fmt.Sprintf("%s-ns-%s", ctx.Namespace, Component),
					Labels: common.DefaultLabels(Component),
				},
				Rules: []rbacv1.PolicyRule{
					{
						APIGroups:     []string{"policy"},
						Resources:     []string{"podsecuritypolicies"},
						Verbs:         []string{"use"},
						ResourceNames: []string{fmt.Sprintf("%s-ns-privileged-unconfined", ctx.Namespace)},
					},
				},
			})
		}
		return nil
	})

	return resources, nil
}
