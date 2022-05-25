// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func role(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(Component)

	return []runtime.Object{
		&rbacv1.ClusterRole{
			TypeMeta: common.TypeMetaClusterRole,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    labels,
			},
			Rules: []rbacv1.PolicyRule{
				{
					APIGroups: []string{"snapshot.storage.k8s.io"},
					Resources: []string{
						"volumesnapshotcontents",
						"volumesnapshotclasses",
					},
					Verbs: []string{
						"get",
						"list",
						"create",
						"update",
						"patch",
						"watch",
						"delete",
						"deletecollection",
					},
				},
			},
		},
		&rbacv1.Role{
			TypeMeta: common.TypeMetaRole,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    labels,
			},
			Rules: []rbacv1.PolicyRule{
				{
					APIGroups: []string{""},
					Resources: []string{
						"pods",
						"pods/log",
						"events",
						"services",
						"endpoints",
						"configmaps",
						"persistentvolumeclaims",
					},
					Verbs: []string{
						"get",
						"list",
						"create",
						"update",
						"patch",
						"watch",
						"delete",
						"deletecollection",
					},
				},
				{
					APIGroups: []string{"snapshot.storage.k8s.io"},
					Resources: []string{
						"volumesnapshots",
					},
					Verbs: []string{
						"get",
						"list",
						"create",
						"update",
						"patch",
						"watch",
						"delete",
						"deletecollection",
					},
				},
			},
		},
	}, nil
}
