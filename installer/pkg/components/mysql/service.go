// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package mysql

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
)

// service this doesn't use the common.GenerateService function
// because it's more complex than this caters for
func service(ctx *common.RenderContext) ([]runtime.Object, error) {
	if !enabled(ctx) {
		return nil, nil
	}

	labels := common.DefaultLabels(Component)

	return []runtime.Object{&corev1.Service{
		TypeMeta: common.TypeMetaService,
		ObjectMeta: metav1.ObjectMeta{
			Name:      Component,
			Namespace: ctx.Namespace,
			Labels:    labels,
		},
		Spec: corev1.ServiceSpec{
			Ports: []corev1.ServicePort{{
				Protocol:   *common.TCPProtocol,
				Port:       Port,
				TargetPort: intstr.IntOrString{IntVal: Port},
			}},
			// todo(sje): selector is different if using CloudSQLProxy
			Selector: map[string]string{
				"app.kubernetes.io/name": "mysql",
			},
			Type: corev1.ServiceTypeClusterIP,
		},
	}}, nil
}
