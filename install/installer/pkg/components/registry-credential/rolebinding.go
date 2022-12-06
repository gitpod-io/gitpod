// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registry_credential

import (
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

func rolebinding(ctx *common.RenderContext) ([]runtime.Object, error) {
	return []runtime.Object{
		&rbacv1.RoleBinding{
			TypeMeta: common.TypeMetaRoleBinding,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			RoleRef: rbacv1.RoleRef{
				Kind:     "Role",
				Name:     Component,
				APIGroup: "rbac.authorization.k8s.io",
			},
			Subjects: []rbacv1.Subject{{
				Kind: "ServiceAccount",
				Name: Component,
			}},
		},
	}, nil
}
