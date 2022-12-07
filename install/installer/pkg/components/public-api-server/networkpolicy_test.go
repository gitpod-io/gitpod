// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.package public_api_server
package public_api_server

import (
	"testing"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/stretchr/testify/require"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

func TestNetworkPolicy(t *testing.T) {
	objects, err := networkpolicy(renderContextWithPublicAPI(t))
	require.NoError(t, err)
	require.Len(t, objects, 1)

	policy, ok := objects[0].(*networkingv1.NetworkPolicy)
	require.Truef(t, ok, "must cast object to network policy")

	ingress := policy.Spec.Ingress
	require.Len(t, ingress, 1, "must have only one ingress rule")

	require.Equal(t, networkingv1.NetworkPolicyIngressRule{
		Ports: []networkingv1.NetworkPolicyPort{
			{
				Protocol: common.TCPProtocol,
				Port:     &intstr.IntOrString{IntVal: GRPCContainerPort},
			},
			{
				Protocol: common.TCPProtocol,
				Port:     &intstr.IntOrString{IntVal: HTTPContainerPort},
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
	}, ingress[0])
}
