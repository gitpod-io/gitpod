// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package workspace

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/webapp/proxy"
	agentsmith "github.com/gitpod-io/gitpod/installer/pkg/components/workspace/agent-smith"
	wsdaemon "github.com/gitpod-io/gitpod/installer/pkg/components/workspace/ws-daemon"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
)

func networkpolicy(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(component)

	podSelectorLabels := labels
	podSelectorLabels["gitpod.io/networkpolicy"] = "default"

	return []runtime.Object{&networkingv1.NetworkPolicy{
		TypeMeta: common.TypeMetaNetworkPolicy,
		ObjectMeta: metav1.ObjectMeta{
			Name:      component + "-default",
			Namespace: ctx.Namespace,
			Labels:    labels,
		},
		Spec: networkingv1.NetworkPolicySpec{
			PodSelector: metav1.LabelSelector{MatchLabels: podSelectorLabels},
			PolicyTypes: []networkingv1.PolicyType{"Ingress", "Egress"},
			Ingress: []networkingv1.NetworkPolicyIngressRule{
				{
					From: []networkingv1.NetworkPolicyPeer{
						{
							PodSelector: &metav1.LabelSelector{MatchLabels: common.DefaultLabels(proxy.Component)},
						},
					},
				},
				{
					From: []networkingv1.NetworkPolicyPeer{
						{
							PodSelector: &metav1.LabelSelector{MatchLabels: common.DefaultLabels(common.WSProxyComponent)},
						},
					},
				},
				{
					From: []networkingv1.NetworkPolicyPeer{
						{
							PodSelector: &metav1.LabelSelector{MatchLabels: common.DefaultLabels(agentsmith.Component)},
						},
					},
				},
				{
					From: []networkingv1.NetworkPolicyPeer{
						{
							PodSelector: &metav1.LabelSelector{MatchLabels: common.DefaultLabels(wsdaemon.Component)},
						},
					},
				},
				{
					Ports: []networkingv1.NetworkPolicyPort{
						{
							Protocol: common.TCPProtocol,
							Port:     &intstr.IntOrString{IntVal: 23000},
						},
					},
					From: []networkingv1.NetworkPolicyPeer{
						{
							NamespaceSelector: &metav1.LabelSelector{MatchLabels: map[string]string{
								"chart": common.MonitoringChart,
							}},
							PodSelector: &metav1.LabelSelector{MatchLabels: common.DefaultLabels(common.ServerComponent)},
						},
					},
				},
			},
			Egress: []networkingv1.NetworkPolicyEgressRule{
				{
					To: []networkingv1.NetworkPolicyPeer{
						{
							IPBlock: &networkingv1.IPBlock{
								CIDR: "0.0.0.0/0",
								// Google Compute engine special, reserved VM metadata IP
								Except: []string{"169.254.169.254/32"},
							},
						},
					},
				},
				{
					To: []networkingv1.NetworkPolicyPeer{
						{
							PodSelector: &metav1.LabelSelector{MatchLabels: common.DefaultLabels(proxy.Component)},
						},
					},
				},
			},
		},
	}}, nil
}
