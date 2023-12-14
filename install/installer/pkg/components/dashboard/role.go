// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dashboard

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func Role(ctx *common.RenderContext) ([]runtime.Object, error) {
	return []runtime.Object{&rbacv1.Role{
		TypeMeta: common.TypeMetaRole,
		ObjectMeta: metav1.ObjectMeta{
			Name:      ComponentServiceAccount,
			Namespace: ctx.Namespace,
			Labels:    common.DefaultLabels(Component),
		},
		Rules: []rbacv1.PolicyRule{
			{
				APIGroups: []string{""},
				Resources: []string{"pods"},
				Verbs: []string{
					"get",
					"list",
				},
			},
		},
	}}, nil
}
