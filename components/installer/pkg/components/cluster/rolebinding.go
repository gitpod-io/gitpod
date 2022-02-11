// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cluster

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	v1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func rolebinding(ctx *common.RenderContext) ([]runtime.Object, error) {
	return []runtime.Object{&v1.RoleBinding{
		TypeMeta: common.TypeMetaRoleBinding,
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("%s-ns-%s", ctx.Namespace, NobodyComponent),
			Namespace: ctx.Namespace,
		},
		Subjects: []v1.Subject{{
			Kind:      "ServiceAccount",
			Name:      NobodyComponent,
			Namespace: ctx.Namespace,
		}},
		RoleRef: v1.RoleRef{
			Kind:     "ClusterRole",
			Name:     fmt.Sprintf("%s-ns-psp:unprivileged", ctx.Namespace),
			APIGroup: "rbac.authorization.k8s.io",
		},
	}}, nil
}
