// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cluster

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func resourcequota(ctx *common.RenderContext) ([]runtime.Object, error) {
	return []runtime.Object{&corev1.ResourceQuota{
		TypeMeta: common.TypeMetaResourceQuota,
		ObjectMeta: metav1.ObjectMeta{
			Name:      "gitpod-resource-quota",
			Namespace: ctx.Namespace,
		},
		Spec: corev1.ResourceQuotaSpec{
			Hard: map[corev1.ResourceName]resource.Quantity{
				"pods": resource.MustParse("10k"),
			},
			ScopeSelector: &corev1.ScopeSelector{
				MatchExpressions: []corev1.ScopedResourceSelectorRequirement{
					{
						Operator:  corev1.ScopeSelectorOpIn,
						ScopeName: corev1.ResourceQuotaScopePriorityClass,
						Values:    []string{common.SystemNodeCritical},
					},
				},
			},
		},
	}}, nil
}
