// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"regexp"
	"sigs.k8s.io/yaml"
	"sort"
)

// Those occurring earlier in the list get installed before those occurring later in the list.
// Based on Helm's list, with our CRDs added in

var sortOrder = []string{
	"Namespace",
	"NetworkPolicy",
	"ResourceQuota",
	"Issuer",      // added
	"Certificate", // added
	"LimitRange",
	"PodSecurityPolicy",
	"PodDisruptionBudget",
	"ServiceAccount",
	"Secret",
	"SecretList",
	"ConfigMap",
	"StorageClass",
	"PersistentVolume",
	"PersistentVolumeClaim",
	"CustomResourceDefinition",
	"ClusterRole",
	"ClusterRoleList",
	"ClusterRoleBinding",
	"ClusterRoleBindingList",
	"Role",
	"RoleList",
	"RoleBinding",
	"RoleBindingList",
	"Service",
	"DaemonSet",
	"Pod",
	"ReplicationController",
	"ReplicaSet",
	"StatefulSet", // moved above Deployment
	"Deployment",
	"HorizontalPodAutoscaler",
	"Job",
	"CronJob",
	"Ingress",
	"APIService",
}

type k8sChart struct {
	metav1.TypeMeta `json:",inline"`
	Content         string
}

func DependencySortingRenderFunc(charts []string) ([]string, error) {
	sortData := make([]k8sChart, 0)

	for _, o := range charts {
		// Assume multi-document YAML
		re := regexp.MustCompile("(^|\n)---")
		items := re.Split(o, -1)

		for _, p := range items {
			var v k8sChart
			err := yaml.Unmarshal([]byte(p), &v)
			if err != nil {
				return nil, err
			}

			v.Content = p
			sortData = append(sortData, v)
		}
	}

	sortMap := map[string]int{}
	for k, v := range sortOrder {
		sortMap[v] = k
	}

	sort.Slice(sortData, func(i, j int) bool {
		scoreI := sortMap[sortData[i].Kind]
		scoreJ := sortMap[sortData[j].Kind]

		return scoreI < scoreJ
	})

	out := make([]string, 0)
	for _, d := range sortData {
		out = append(out, d.Content)
	}

	return out, nil
}
