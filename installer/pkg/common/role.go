// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	"fmt"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func ListAndGetPodsRole(ctx *RenderContext) ([]runtime.Object, error) {
	return []runtime.Object{
		&rbacv1.Role{
			TypeMeta: TypeMetaRole,
			ObjectMeta: metav1.ObjectMeta{
				Name:      "ListAndGetPods",
				Namespace: ctx.Namespace,
			},
			Rules: []rbacv1.PolicyRule{
				{
					APIGroups: []string{""},
					Resources: []string{
						"pods",
					},
					Verbs: []string{
						"get",
						"list",
						"watch",
					},
				},
			},
		},
	}, nil
}

func ListAndGetPodsRoleBinding(ctx *RenderContext, component string) runtime.Object {
	return &rbacv1.RoleBinding{
		TypeMeta: TypeMetaRoleBinding,
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("listAndGetPods-%v", component),
			Namespace: ctx.Namespace,
			Labels:    DefaultLabels(component),
		},
		RoleRef: rbacv1.RoleRef{
			Kind:     "Role",
			Name:     "ListAndGetPods",
			APIGroup: "rbac.authorization.k8s.io",
		},
		Subjects: []rbacv1.Subject{{
			Kind: "ServiceAccount",
			Name: component,
		}},
	}
}
