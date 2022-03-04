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

func clusterrole(ctx *common.RenderContext) ([]runtime.Object, error) {
	return []runtime.Object{
		&v1.ClusterRole{
			TypeMeta: common.TypeMetaClusterRole,
			ObjectMeta: metav1.ObjectMeta{
				Name: fmt.Sprintf("%s-kube-rbac-proxy", ctx.Namespace),
			},
			Rules: []v1.PolicyRule{{
				APIGroups: []string{"authentication.k8s.io"},
				Resources: []string{"tokenreviews"},
				Verbs:     []string{"create"},
			}, {
				APIGroups: []string{"authorization.k8s.io"},
				Resources: []string{"subjectaccessreviews"},
				Verbs:     []string{"create"},
			}},
		},
		&v1.ClusterRole{
			TypeMeta: common.TypeMetaClusterRole,
			ObjectMeta: metav1.ObjectMeta{
				Name: fmt.Sprintf("%s-ns-psp:privileged", ctx.Namespace),
			},
			Rules: []v1.PolicyRule{{
				APIGroups:     []string{"policy"},
				Resources:     []string{"podsecuritypolicies"},
				Verbs:         []string{"use"},
				ResourceNames: []string{fmt.Sprintf("%s-ns-privileged", ctx.Namespace)},
			}},
		},
		&v1.ClusterRole{
			TypeMeta: common.TypeMetaClusterRole,
			ObjectMeta: metav1.ObjectMeta{
				Name: fmt.Sprintf("%s-ns-psp:restricted-root-user", ctx.Namespace),
			},
			Rules: []v1.PolicyRule{{
				APIGroups:     []string{"policy"},
				Resources:     []string{"podsecuritypolicies"},
				Verbs:         []string{"use"},
				ResourceNames: []string{fmt.Sprintf("%s-ns-restricted-root-user", ctx.Namespace)},
			}},
		},
		&v1.ClusterRole{
			TypeMeta: common.TypeMetaClusterRole,
			ObjectMeta: metav1.ObjectMeta{
				Name: fmt.Sprintf("%s-ns-psp:unprivileged", ctx.Namespace),
			},
			Rules: []v1.PolicyRule{{
				APIGroups:     []string{"policy"},
				Resources:     []string{"podsecuritypolicies"},
				Verbs:         []string{"use"},
				ResourceNames: []string{fmt.Sprintf("%s-ns-unprivileged", ctx.Namespace)},
			}},
		},
	}, nil
}
