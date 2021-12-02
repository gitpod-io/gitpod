// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanagerbridge

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func rolebinding(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(Component, ctx)

	return []runtime.Object{
		&rbacv1.RoleBinding{
			TypeMeta: common.TypeMetaRoleBinding,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    labels,
			},
			RoleRef: rbacv1.RoleRef{
				APIGroup: "rbac.authorization.k8s.io",
				Kind:     "ClusterRole",
				Name:     fmt.Sprintf("%s-ns-psp:unprivileged", ctx.Namespace),
			},
			Subjects: []rbacv1.Subject{
				{
					Kind: "ServiceAccount",
					Name: Component,
				},
			},
		},
	}, nil
}
