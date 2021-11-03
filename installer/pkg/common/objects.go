// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	"fmt"

	storageconfig "github.com/gitpod-io/gitpod/content-service/api/config"
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

func StorageConfiguration(ctx *RenderContext) (*storageconfig.StorageConfig, error) {
	accessKey := ctx.Values.StorageAccessKey
	if accessKey == "" {
		return nil, fmt.Errorf("unknown value: storage access key")
	}
	secretKey := ctx.Values.StorageSecretKey
	if secretKey == "" {
		return nil, fmt.Errorf("unknown value: storage secret key")
	}

	// todo(sje): support non-Minio storage configuration
	// todo(sje): this has been set up with only the default values - receive configuration
	return &storageconfig.StorageConfig{
		Kind:      "minio",
		BlobQuota: 0,
		MinIOConfig: storageconfig.MinIOConfig{
			Endpoint:        fmt.Sprintf("minio.%s", ctx.Config.Domain),
			AccessKeyID:     accessKey,
			SecretAccessKey: secretKey,
			Secure:          false,
			Region:          "local",
		},
	}, nil
}
