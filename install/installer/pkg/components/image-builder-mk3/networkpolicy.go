// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package image_builder_mk3

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/server"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"

	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func networkpolicy(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(Component)
	var ingressRules []networkingv1.NetworkPolicyPeer
	// Allow all ingress in workspace clusters
	// until https://github.com/gitpod-io/ops/issues/6905 is fixed.
	if ctx.Config.Kind != config.InstallationWorkspace {
		ingressRules = []networkingv1.NetworkPolicyPeer{
			{
				PodSelector: &metav1.LabelSelector{
					MatchLabels: map[string]string{
						"component": server.Component,
					},
				},
			},
			{
				PodSelector: &metav1.LabelSelector{
					MatchLabels: map[string]string{
						"component": common.SlowServerComponent,
					},
				},
			},
			{
				PodSelector: &metav1.LabelSelector{
					MatchLabels: map[string]string{
						"component": common.WSManagerComponent,
					},
				},
			},
		}
	}

	return []runtime.Object{
		&networkingv1.NetworkPolicy{
			TypeMeta: common.TypeMetaNetworkPolicy,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    labels,
			},
			Spec: networkingv1.NetworkPolicySpec{
				PodSelector: metav1.LabelSelector{MatchLabels: labels},
				PolicyTypes: []networkingv1.PolicyType{"Ingress"},
				Ingress: []networkingv1.NetworkPolicyIngressRule{
					{
						From: ingressRules,
					},
				},
			},
		},
	}, nil
}
