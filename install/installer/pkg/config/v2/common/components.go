// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import corev1 "k8s.io/api/core/v1"

type Components struct {
	Proxy *ProxyComponent `json:"proxy,omitempty"`
}

type ProxyComponent struct {
	Service *ComponentTypeService `json:"service,omitempty"`
}

type ComponentTypeService struct {
	ServiceType *corev1.ServiceType `json:"serviceType,omitempty" validate:"omitempty,service_config_type"`
}
