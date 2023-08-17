// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import (
	"fmt"

	policy "k8s.io/api/policy/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

func PodDisruptionBudget(ctx *RenderContext, component string, maxUnavailable int, selector *v1.LabelSelector) *policy.PodDisruptionBudget {
	muCount := intstr.FromInt(maxUnavailable)

	return &policy.PodDisruptionBudget{
		TypeMeta: TypePodDisruptionBudget,
		ObjectMeta: v1.ObjectMeta{
			Name:      fmt.Sprintf("%v-pdb", component),
			Namespace: ctx.Namespace,
		},
		Spec: policy.PodDisruptionBudgetSpec{
			MaxUnavailable: &muCount,
			Selector:       selector,
		},
	}
}
