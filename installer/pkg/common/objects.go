// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func DefaultServiceAccount(component string) RenderFunc {
	return func(cfg *RenderContext) ([]runtime.Object, error) {
		return []runtime.Object{
			&corev1.ServiceAccount{
				ObjectMeta: metav1.ObjectMeta{
					Name:   component,
					Labels: DefaultLabels(component),
				},
				AutomountServiceAccountToken: pointer.Bool(true),
			},
		}, nil
	}
}
