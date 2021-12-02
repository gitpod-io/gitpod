// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	corev1 "k8s.io/api/core/v1"
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

type RuntimeObject struct {
	metav1.TypeMeta `json:",inline"`
	Metadata        metav1.ObjectMeta `json:"metadata"`
	Content         string            `json:"-"`
}

func DependencySortingRenderFunc(objects []RuntimeObject) ([]RuntimeObject, error) {
	sortMap := map[string]int{}
	for k, v := range sortOrder {
		sortMap[v] = k
	}

	sort.Slice(objects, func(i, j int) bool {
		scoreI := sortMap[objects[i].Kind]
		scoreJ := sortMap[objects[j].Kind]

		return scoreI < scoreJ
	})

	return objects, nil
}

func GenerateInstallationConfigMap(ctx *RenderContext, objects []RuntimeObject) ([]RuntimeObject, error) {
	cfgMapData := make([]string, 0)
	component := "gitpod-app"

	// Convert to a simplified object that allows us to access the objects
	for _, c := range objects {
		if c.Kind != "" {
			marshal, err := yaml.Marshal(c)
			if err != nil {
				return nil, err
			}

			cfgMapData = append(cfgMapData, string(marshal))
		}
	}

	cfgMap := corev1.ConfigMap{
		TypeMeta: TypeMetaConfigmap,
		ObjectMeta: metav1.ObjectMeta{
			Name:      component,
			Namespace: ctx.Namespace,
			Labels:    DefaultLabels(component, ctx),
		},
	}

	// generate the config map data so it can be injected to the object
	marshal, err := yaml.Marshal(cfgMap)
	if err != nil {
		return nil, err
	}

	cfgMapData = append(cfgMapData, string(marshal))

	// Generate the data, including this config map
	cfgMap.Data = map[string]string{
		"app.yaml": strings.Join(cfgMapData, "---\n"),
	}

	// regenerate the config map so it can be injected into the charts with this config map in
	marshal, err = yaml.Marshal(cfgMap)
	if err != nil {
		return nil, err
	}

	// Add in the ConfigMap
	objects = append(objects, RuntimeObject{
		TypeMeta: cfgMap.TypeMeta,
		Metadata: cfgMap.ObjectMeta,
		Content:  string(marshal),
	})

	return objects, nil
}

func YamlToRuntimeObject(objects []string) ([]RuntimeObject, error) {
	sortedObjects := make([]RuntimeObject, 0, len(objects))
	for _, o := range objects {
		// Assume multi-document YAML
		re := regexp.MustCompile("(^|\n)---")
		items := re.Split(o, -1)

		for _, p := range items {
			var v RuntimeObject
			err := yaml.Unmarshal([]byte(p), &v)
			if err != nil {
				return nil, err
			}

			// remove any empty charts
			ctnt := strings.Trim(p, "\n")
			if len(strings.TrimSpace(ctnt)) == 0 {
				continue
			}

			v.Content = ctnt
			sortedObjects = append(sortedObjects, v)
		}
	}

	return sortedObjects, nil
}
