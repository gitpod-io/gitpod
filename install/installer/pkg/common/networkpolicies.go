// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	corev1 "k8s.io/api/core/v1"
	v1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

func AllowKubeDnsEgressRule() v1.NetworkPolicyEgressRule {
	var tcp = corev1.ProtocolTCP
	var udp = corev1.ProtocolUDP

	dnsEgressRule := v1.NetworkPolicyEgressRule{
		Ports: []v1.NetworkPolicyPort{
			{
				Protocol: &tcp,
				Port: &intstr.IntOrString{
					IntVal: 53,
				},
			},
			{
				Protocol: &udp,
				Port: &intstr.IntOrString{
					IntVal: 53,
				},
			},
		},
		To: []v1.NetworkPolicyPeer{{
			PodSelector: &metav1.LabelSelector{
				MatchLabels: map[string]string{
					"k8s-app": "kube-dns",
				},
			},
			NamespaceSelector: &metav1.LabelSelector{},
		}},
	}

	return dnsEgressRule
}

func AllowWSManagerEgressRule() v1.NetworkPolicyEgressRule {
	var tcp = corev1.ProtocolTCP

	dnsEgressRule := v1.NetworkPolicyEgressRule{
		Ports: []v1.NetworkPolicyPort{
			{
				Protocol: &tcp,
				Port: &intstr.IntOrString{
					IntVal: 8080,
				},
			},
		},
		To: []v1.NetworkPolicyPeer{{
			PodSelector: &metav1.LabelSelector{
				MatchLabels: map[string]string{
					"app":       AppName,
					"component": WSManagerComponent,
				},
			},
			NamespaceSelector: &metav1.LabelSelector{},
		}},
	}

	return dnsEgressRule
}
