// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	"fmt"
	"regexp"
	"sort"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/yaml"
)

// Those occurring earlier in the list get installed before those occurring later in the list.
// Based on Helm's list, with our CRDs added in

var sortOrder = []string{
	"Namespace",
	"NetworkPolicy",
	"ResourceQuota",
	"Issuer",
	"Certificate",
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
	"StatefulSet",
	"Deployment",
	"HorizontalPodAutoscaler",
	"Job",
	"CronJob",
	"Ingress",
	"APIService",
}

type runtimeObject struct {
	metav1.TypeMeta `json:",inline"`
	Metadata        metav1.ObjectMeta `json:"metadata"`
	Content         string
}

func DependencySortingRenderFunc(objects []string) ([]string, error) {
	sortData := make([]runtimeObject, 0, len(objects))
	for _, o := range objects {
		// Assume multi-document YAML
		re := regexp.MustCompile("(^|\n)---")
		items := re.Split(o, -1)

		for _, p := range items {
			var v runtimeObject
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

	out := make([]string, 0, len(sortData))
	for _, d := range sortData {
		ctnt := strings.Trim(d.Content, "\n")
		if len(strings.TrimSpace(ctnt)) == 0 {
			continue
		}
		ctnt = fmt.Sprintf("# %s/%s %s\n%s", d.TypeMeta.APIVersion, d.TypeMeta.Kind, d.Metadata.Name, ctnt)
		out = append(out, ctnt)
	}

	return out, nil
}
