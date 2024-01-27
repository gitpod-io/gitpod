// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package registryfacade

import (
	corev1 "k8s.io/api/core/v1"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

var Objects = common.CompositeRenderFunc(
	clusterrole,
	configmap,
	daemonset,
	networkpolicy,
	rolebinding,
	certificate,
	common.GenerateService(Component, []common.ServicePort{
		{
			Name:          ContainerPortName,
			ContainerPort: ServicePort,
			ServicePort:   ServicePort,
		},
	}, func(svc *corev1.Service) {
		svc.Spec.Type = corev1.ServiceTypeNodePort
		svc.Spec.ExternalTrafficPolicy = corev1.ServiceExternalTrafficPolicyTypeLocal

		clusterInternalTrafficPolicy := corev1.ServiceInternalTrafficPolicyLocal
		svc.Spec.InternalTrafficPolicy = &clusterInternalTrafficPolicy

		svc.Spec.Ports[0].NodePort = common.RegistryFacadeServicePort
	}),
	common.DefaultServiceAccount(Component),
)
