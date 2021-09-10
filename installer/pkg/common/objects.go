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
				TypeMeta: TypeMetaServiceAccount,
				ObjectMeta: metav1.ObjectMeta{
					Name:      component,
					Namespace: cfg.Namespace,
					Labels:    DefaultLabels(component),
				},
				AutomountServiceAccountToken: pointer.Bool(true),
			},
		}, nil
	}
}

func GenerateService(component string) RenderFunc {
	return func(cfg *RenderContext) ([]runtime.Object, error) {
		labels := DefaultLabels(component)

		return []runtime.Object{&corev1.Service{
			TypeMeta: TypeMetaService,
			ObjectMeta: metav1.ObjectMeta{
				Name:      component,
				Namespace: cfg.Namespace,
				Labels:    labels,
			},
			// todo(sje): decide how to pass a lot of config in with default values
			Spec: corev1.ServiceSpec{
				Ports:                 []corev1.ServicePort{},
				Selector:              map[string]string{},
				Type:                  "",
				ClusterIP:             "",
				SessionAffinity:       "",
				ExternalTrafficPolicy: "",
				LoadBalancerIP:        "",
			},
		}}, nil
	}
}
