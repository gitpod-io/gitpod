package wsmanager

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// @todo(sje) establish how to pass in config with cw
func networkpolicy(ctx *common.RenderContext) ([]runtime.Object, error) {
	if !ctx.Config.InstallNetworkPolicies {
		return nil, nil
	}

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
				Ingress: []networkingv1.NetworkPolicyIngressRule{},
			},
		},
	}, nil
}
