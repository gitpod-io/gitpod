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
		pullSecrets := make([]corev1.LocalObjectReference, 0)

		if len(cfg.Config.ImagePullSecrets) > 0 {
			for _, i := range cfg.Config.ImagePullSecrets {
				pullSecrets = append(pullSecrets, corev1.LocalObjectReference{
					Name: i.Name,
				})
			}
		}

		return []runtime.Object{
			&corev1.ServiceAccount{
				TypeMeta: TypeMetaServiceAccount,
				ObjectMeta: metav1.ObjectMeta{
					Name:      component,
					Namespace: cfg.Namespace,
					Labels:    DefaultLabels(component),
				},
				AutomountServiceAccountToken: pointer.Bool(true),
				ImagePullSecrets:             pullSecrets,
			},
		}, nil
	}
}

type ServicePort struct {
	ContainerPort int32
	ServicePort   int32
}

func GenerateService(component string, ports map[string]ServicePort, mod ...func(spec *corev1.Service)) RenderFunc {
	return func(cfg *RenderContext) ([]runtime.Object, error) {
		var servicePorts []corev1.ServicePort
		for name, port := range ports {
			servicePorts = append(servicePorts, corev1.ServicePort{
				Protocol:   *TCPProtocol,
				Name:       name,
				Port:       port.ServicePort,
				TargetPort: intstr.IntOrString{IntVal: port.ContainerPort},
			})
		}

		// kind=service is required for services. It allows Gitpod to find them
		serviceLabels := DefaultLabels(component)
		serviceLabels["kind"] = "service"

		service := &corev1.Service{
			TypeMeta: TypeMetaService,
			ObjectMeta: metav1.ObjectMeta{
				Name:        component,
				Namespace:   cfg.Namespace,
				Labels:      serviceLabels,
				Annotations: make(map[string]string),
			},
			Spec: corev1.ServiceSpec{
				Ports:    servicePorts,
				Selector: DefaultLabels(component),
				Type:     corev1.ServiceTypeClusterIP,
			},
		}

		for _, m := range mod {
			// Apply any custom modifications to the spec
			m(service)
		}

		return []runtime.Object{service}, nil
	}
}

// DockerRegistryHash creates a sample pod spec that can be converted into a hash for annotations
func DockerRegistryHash(ctx *RenderContext) ([]runtime.Object, error) {
	if !pointer.BoolDeref(ctx.Config.ContainerRegistry.InCluster, false) {
		return nil, nil
	}

	return []runtime.Object{&corev1.Pod{Spec: corev1.PodSpec{
		Containers: []corev1.Container{{
			Env: []corev1.EnvVar{{
				Name:  "DOCKER_REGISTRY_USERNAME",
				Value: ctx.Values.InternalRegistryUsername,
			}, {
				Name:  "DOCKER_REGISTRY_PASSWORD",
				Value: ctx.Values.InternalRegistryPassword,
			}},
		}},
	}}}, nil
}
