// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func Role(ctx *common.RenderContext, component string) ([]runtime.Object, error) {
	return []runtime.Object{&rbacv1.Role{
		TypeMeta: common.TypeMetaRole,
		ObjectMeta: metav1.ObjectMeta{
			Name:      component,
			Namespace: ctx.Namespace,
			Labels:    common.DefaultLabels(component),
		},
		Rules: []rbacv1.PolicyRule{
			{
				APIGroups: []string{""},
				Resources: []string{"services"},
				Verbs: []string{
					"get",
					"list",
					"create",
					"update",
					"patch",
					"watch",
				},
			},
			{
				APIGroups: []string{""},
				Resources: []string{"pods", "pods/log"},
				Verbs: []string{
					"get",
					"list",
					"create",
					"update",
					"patch",
					"watch",
				},
			},
		},
	}}, nil
}
