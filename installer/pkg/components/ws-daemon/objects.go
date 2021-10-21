// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsdaemon

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
)

var Objects = common.CompositeRenderFunc(
	clusterrole,
	configmap,
	common.DefaultServiceAccount(Component),
	daemonset,
	networkpolicy,
	rolebinding,
	common.GenerateService(Component, nil, func(spec *corev1.ServiceSpec) {
		spec.ClusterIP = "None"
	}),
	tlssecret,
)
