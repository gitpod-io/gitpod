// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
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

type ServicePort struct {
	ContainerPort int32
	ServicePort   int32
}

func GenerateService(component string, ports map[string]ServicePort, mod ...func(spec *corev1.ServiceSpec)) RenderFunc {
	return func(cfg *RenderContext) ([]runtime.Object, error) {
		labels := DefaultLabels(component)

		var servicePorts []corev1.ServicePort
		for name, port := range ports {
			servicePorts = append(servicePorts, corev1.ServicePort{
				Protocol:   *TCPProtocol,
				Name:       name,
				Port:       port.ServicePort,
				TargetPort: intstr.IntOrString{IntVal: port.ContainerPort},
			})
		}

		spec := &corev1.ServiceSpec{
			Ports:    servicePorts,
			Selector: labels,
			Type:     corev1.ServiceTypeClusterIP,
		}

		for _, m := range mod {
			// Apply any custom modifications to the spec
			m(spec)
		}

		return []runtime.Object{&corev1.Service{
			TypeMeta: TypeMetaService,
			ObjectMeta: metav1.ObjectMeta{
				Name:      component,
				Namespace: cfg.Namespace,
				Labels:    labels,
			},
			Spec: *spec,
		}}, nil
	}
}
