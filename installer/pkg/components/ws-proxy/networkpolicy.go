package wsproxy

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
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

	// todo(sje): do we need this wsManagerProxy port?
	var wsManagerProxy networkingv1.NetworkPolicyPort

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
					Port:     &intstr.IntOrString{IntVal: HTTPProxyPort},
				}, {
					Protocol: common.TCPProtocol,
					Port:     &intstr.IntOrString{IntVal: HTTPSProxyPort},
				}, wsManagerProxy},
			}},
		},
	}}, nil
}
