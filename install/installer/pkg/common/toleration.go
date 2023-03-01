// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import (
	corev1 "k8s.io/api/core/v1"
)

func GPUToleration() []corev1.Toleration {
	return []corev1.Toleration{
		{
			Effect:   corev1.TaintEffectNoSchedule,
			Key:      "nvidia.com/gpu",
			Operator: corev1.TolerationOpExists,
		},
	}
}
