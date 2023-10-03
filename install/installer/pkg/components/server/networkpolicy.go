// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/gitpod"

	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
)

func Networkpolicy(ctx *common.RenderContext, component string) ([]runtime.Object, error) {
	labels := common.DefaultLabels(component)

	return []runtime.Object{
		&networkingv1.NetworkPolicy{
			TypeMeta: common.TypeMetaNetworkPolicy,
			ObjectMeta: metav1.ObjectMeta{
				Name:      component,
				Namespace: ctx.Namespace,
				Labels:    labels,
			},
			Spec: networkingv1.NetworkPolicySpec{
				PodSelector: metav1.LabelSelector{MatchLabels: labels},
				PolicyTypes: []networkingv1.PolicyType{"Ingress"},
				Ingress: []networkingv1.NetworkPolicyIngressRule{
					{
						Ports: []networkingv1.NetworkPolicyPort{
							{
								Protocol: common.TCPProtocol,
								Port:     &intstr.IntOrString{IntVal: ContainerPort},
							},
							{
								Protocol: common.TCPProtocol,
								Port:     &intstr.IntOrString{IntVal: PublicAPIPort},
							},
						},
						From: []networkingv1.NetworkPolicyPeer{
							{
								PodSelector: &metav1.LabelSelector{
									MatchLabels: map[string]string{
										"component": common.ProxyComponent,
									},
								},
							},
						},
					},
					{
						Ports: []networkingv1.NetworkPolicyPort{
							{
								Protocol: common.TCPProtocol,
								Port:     &intstr.IntOrString{IntVal: ContainerPort},
							},
						},
						From: []networkingv1.NetworkPolicyPeer{
							{
								PodSelector: &metav1.LabelSelector{
									MatchLabels: map[string]string{
										"component": common.PublicApiComponent,
									},
								},
							},
						},
					},
					{
						Ports: []networkingv1.NetworkPolicyPort{
							{
								Protocol: common.TCPProtocol,
								Port:     &intstr.IntOrString{IntVal: baseserver.BuiltinMetricsPort},
							},
						},
						From: []networkingv1.NetworkPolicyPeer{
							{
								NamespaceSelector: &metav1.LabelSelector{
									MatchLabels: map[string]string{
										"chart": common.MonitoringChart,
									},
								},
								PodSelector: &metav1.LabelSelector{
									MatchLabels: map[string]string{
										"component": common.ProxyComponent,
									},
								},
							},
						},
					},
					{
						Ports: []networkingv1.NetworkPolicyPort{
							{
								Protocol: common.TCPProtocol,
								Port:     &intstr.IntOrString{IntVal: InstallationAdminPort},
							},
						},
						From: []networkingv1.NetworkPolicyPeer{
							{
								PodSelector: &metav1.LabelSelector{
									MatchLabels: map[string]string{
										"component": gitpod.Component,
									},
								},
							},
						},
					},
					{
						Ports: []networkingv1.NetworkPolicyPort{
							{
								Protocol: common.TCPProtocol,
								Port:     &intstr.IntOrString{IntVal: IAMSessionPort},
							},
						},
						From: []networkingv1.NetworkPolicyPeer{
							{
								PodSelector: &metav1.LabelSelector{
									MatchLabels: map[string]string{
										"app":       "gitpod",
										"component": common.PublicApiComponent,
									},
								},
							},
						},
					},
					{
						Ports: []networkingv1.NetworkPolicyPort{
							{
								Protocol: common.TCPProtocol,
								Port:     &intstr.IntOrString{IntVal: GRPCAPIPort},
							},
						},
						From: []networkingv1.NetworkPolicyPeer{
							{
								PodSelector: &metav1.LabelSelector{
									MatchLabels: map[string]string{
										"app":       "gitpod",
										"component": common.PublicApiComponent,
									},
								},
							},
							{
								PodSelector: &metav1.LabelSelector{
									MatchLabels: map[string]string{
										"app":       "gitpod",
										"component": common.UsageComponent,
									},
								},
							},
						},
					},
				},
			},
		},
	}, nil
}
