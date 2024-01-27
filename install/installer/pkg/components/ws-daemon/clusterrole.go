// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsdaemon

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func clusterrole(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(Component)

	return []runtime.Object{
		&rbacv1.ClusterRole{
			TypeMeta: common.TypeMetaClusterRole,
			ObjectMeta: metav1.ObjectMeta{
				Name:   fmt.Sprintf("%s-ns-%s", ctx.Namespace, Component),
				Labels: labels,
			},
			Rules: []rbacv1.PolicyRule{
				{
					APIGroups: []string{""},
					Resources: []string{"nodes"},
					Verbs:     []string{"get", "list", "update", "patch"},
				},
				{
					APIGroups: []string{""},
					Resources: []string{"pods", "services"},
					Verbs:     []string{"get", "list", "watch"},
				},
				{
					APIGroups: []string{""},
					Resources: []string{"pods"},
					Verbs:     []string{"delete", "update", "patch"},
				},
				{
					APIGroups: []string{"workspace.gitpod.io"},
					Resources: []string{"workspaces"},
					Verbs: []string{
						"get",
						"list",
						"watch",
					},
				},
				{
					APIGroups: []string{"workspace.gitpod.io"},
					Resources: []string{"workspaces/status"},
					Verbs: []string{
						"get",
						"patch",
						"update",
					},
				},
				{
					APIGroups: []string{"workspace.gitpod.io"},
					Resources: []string{"snapshots"},
					Verbs: []string{
						"get",
						"list",
						"watch",
					},
				},
				{
					APIGroups: []string{"workspace.gitpod.io"},
					Resources: []string{"snapshots/status"},
					Verbs: []string{
						"get",
						"patch",
						"update",
					},
				},
				{
					APIGroups: []string{""},
					Resources: []string{"events"},
					Verbs: []string{
						"create",
						"patch",
					},
				},
			},
		},
	}, nil
}
