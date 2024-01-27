// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cluster

import (
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Valid characters for affinities are alphanumeric, -, _, . and one / as a subdomain prefix
const (
	AffinityLabelMeta               = "gitpod.io/workload_meta"
	AffinityLabelIDE                = "gitpod.io/workload_ide"
	AffinityLabelServices           = "gitpod.io/workload_services"
	AffinityLabelWorkspacesRegular  = "gitpod.io/workload_workspace_regular"
	AffinityLabelWorkspacesHeadless = "gitpod.io/workload_workspace_headless"

	HostnameTopologyKey = "kubernetes.io/hostname"
)

var AffinityListMeta = []string{
	AffinityLabelMeta,
	AffinityLabelIDE,
	AffinityLabelServices,
}

var AffinityListWorkspace = []string{
	AffinityLabelServices,
	AffinityLabelWorkspacesRegular,
	AffinityLabelWorkspacesHeadless,
}

var AffinityList = func() []string {
	list := []string{}

	list = append(list, AffinityListMeta...)
	list = append(list, AffinityListWorkspace...)

	return list
}()

func WithPodAntiAffinityHostname(component string) *corev1.PodAntiAffinity {
	return &corev1.PodAntiAffinity{
		PreferredDuringSchedulingIgnoredDuringExecution: []corev1.WeightedPodAffinityTerm{
			{
				Weight: 100,
				PodAffinityTerm: corev1.PodAffinityTerm{
					LabelSelector: &metav1.LabelSelector{
						MatchExpressions: []metav1.LabelSelectorRequirement{{
							Key:      "component",
							Operator: "In",
							Values:   []string{component},
						}},
					},
					TopologyKey: HostnameTopologyKey,
				},
			},
		},
	}
}

func defaultLabels(component string) map[string]string {
	return map[string]string{
		"app":       "gitpod",
		"component": component,
	}
}

func WithHostnameTopologySpread(component string) []corev1.TopologySpreadConstraint {
	return []corev1.TopologySpreadConstraint{
		{
			LabelSelector:     &metav1.LabelSelector{MatchLabels: defaultLabels(component)},
			MaxSkew:           1,
			TopologyKey:       HostnameTopologyKey,
			WhenUnsatisfiable: corev1.ScheduleAnyway,
		},
	}
}

func WithNodeAffinityHostnameAntiAffinity(component string, orLabels ...string) *corev1.Affinity {
	var terms []corev1.NodeSelectorTerm

	for _, lbl := range orLabels {
		terms = append(terms, corev1.NodeSelectorTerm{
			MatchExpressions: []corev1.NodeSelectorRequirement{
				{
					Key:      lbl,
					Operator: corev1.NodeSelectorOpExists,
				},
			},
		})
	}

	return &corev1.Affinity{
		NodeAffinity: &corev1.NodeAffinity{
			RequiredDuringSchedulingIgnoredDuringExecution: &corev1.NodeSelector{
				NodeSelectorTerms: terms,
			},
		},
		PodAntiAffinity: WithPodAntiAffinityHostname(component),
	}
}

func WithNodeAffinity(orLabels ...string) *corev1.Affinity {
	var terms []corev1.NodeSelectorTerm

	for _, lbl := range orLabels {
		terms = append(terms, corev1.NodeSelectorTerm{
			MatchExpressions: []corev1.NodeSelectorRequirement{
				{
					Key:      lbl,
					Operator: corev1.NodeSelectorOpExists,
				},
			},
		})
	}

	return &corev1.Affinity{
		NodeAffinity: &corev1.NodeAffinity{
			RequiredDuringSchedulingIgnoredDuringExecution: &corev1.NodeSelector{
				NodeSelectorTerms: terms,
			},
		},
	}
}
