package blobserve

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsproxy "github.com/gitpod-io/gitpod/installer/pkg/components/ws-proxy"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
)

func networkpolicy(ctx *common.RenderContext) ([]runtime.Object, error) {
	if !ctx.Config.InstallNetworkPolicies {
		return nil, nil
	}

	labels := common.DefaultLabels(Component)

	return []runtime.Object{&networkingv1.NetworkPolicy{
		TypeMeta: common.TypeMetaNetworkPolicy,
		ObjectMeta: metav1.ObjectMeta{
			Name:      Component,
			Namespace: ctx.Namespace,
			Labels:    labels,
		},
		Spec: networkingv1.NetworkPolicySpec{
			PodSelector: metav1.LabelSelector{MatchLabels: labels},
			PolicyTypes: []networkingv1.PolicyType{"Ingress"},
			Ingress: []networkingv1.NetworkPolicyIngressRule{{
				Ports: []networkingv1.NetworkPolicyPort{{
					Protocol: common.TCPProtocol,
					Port:     &intstr.IntOrString{IntVal: ContainerPort},
				}},
				From: []networkingv1.NetworkPolicyPeer{{
					PodSelector: &metav1.LabelSelector{MatchLabels: map[string]string{
						"component": "proxy", // todo(sje): get variable from the (future) proxy package
					}},
				}, {
					PodSelector: &metav1.LabelSelector{MatchLabels: map[string]string{
						"component": wsproxy.Component,
					}},
				}},
			}},
		},
	}}, nil
}
