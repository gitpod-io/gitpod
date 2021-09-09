package wsdaemon

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	v1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
)

// @todo(sje) establish how to pass in config with cw
func networkpolicy(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(component)

	var tcpProtocol v1.Protocol
	tcpProtocol = v1.ProtocolTCP

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
								Protocol: &tcpProtocol,
								Port:     &intstr.IntOrString{IntVal: 8080}, // @todo(sje) use variable
							},
						},
						From: []networkingv1.NetworkPolicyPeer{
							{
								PodSelector: &metav1.LabelSelector{MatchLabels: labels},
							},
						},
					},
					{
						Ports: []networkingv1.NetworkPolicyPort{
							{
								Protocol: &tcpProtocol,
								Port:     &intstr.IntOrString{IntVal: 9500},
							},
						},
						From: []networkingv1.NetworkPolicyPeer{
							{
								NamespaceSelector: &metav1.LabelSelector{MatchLabels: map[string]string{
									"chart": "monitoring", // @todo(sje) do we need this if not in Helm?
								}},
								PodSelector: &metav1.LabelSelector{
									MatchLabels: map[string]string{
										"app":       "prometheus",
										"component": "server",
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
