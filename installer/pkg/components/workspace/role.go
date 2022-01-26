// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func role(ctx *common.RenderContext) ([]runtime.Object, error) {
	return []runtime.Object{&rbacv1.Role{
		TypeMeta: common.TypeMetaRole,
		ObjectMeta: metav1.ObjectMeta{
			Name:      component,
			Namespace: ctx.Namespace,
			Labels:    common.DefaultLabels(component),
		},
		Rules: []rbacv1.PolicyRule{
			{
				APIGroups:     []string{"policy"},
				Resources:     []string{"podsecuritypolicies"},
				Verbs:         []string{"use"},
				ResourceNames: []string{fmt.Sprintf("%s-ns-workspace", ctx.Namespace)},
			},
		},
	}}, nil
}
