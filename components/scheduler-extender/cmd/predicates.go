// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
	v1 "k8s.io/api/core/v1"

	"github.com/gitpod-io/gitpod/scheduler/pkg/extender"
)

const (
	regularNodeLabel  = "gitpod.io/workload_workspace_regular"
	headlessNodeLabel = "gitpod.io/workload_workspace_headless"
	workspaceType     = "workspaceType"
)

var (
	namespace = "default"

	requiredLabels = []string{
		"gitpod.io/registry-facade_ready_ns_%v",
		"gitpod.io/ws-daemon_ready_ns_%v",
	}
)

var (
	WorkspacePredicate = extender.Predicate{
		Name: "gitpod",
		Func: func(pod corev1.Pod, node corev1.Node) (bool, error) {
			if !isWorkspace(pod) {
				return true, nil
			}

			if !isWorkspaceNode(node) {
				return false, nil
			}

			if isWorkspaceHeadless(pod) && !isValidWorkspaceNode(headlessNodeLabel, node) {
				return false, nil
			}

			if isWorkspaceRegular(pod) && !isValidWorkspaceNode(regularNodeLabel, node) {
				return false, nil
			}

			for _, labelTemplate := range requiredLabels {
				label := fmt.Sprintf(labelTemplate, namespace)
				val, hasLabel := node.Labels[label]
				if !hasLabel {
					return false, fmt.Errorf("node %v does not have the required label", label)
				}

				if val != "true" {
					return false, fmt.Errorf("unexpected node label %v value: %v", label, val)
				}
			}

			return true, nil
		},
	}
)

func isWorkspace(pod corev1.Pod) bool {
	val, ok := pod.ObjectMeta.Labels["component"]
	return ok && val == "workspace"
}

func isWorkspaceNode(node corev1.Node) bool {
	if _, ok := node.Labels[regularNodeLabel]; ok {
		return true
	}

	if _, ok := node.Labels[headlessNodeLabel]; ok {
		return true
	}

	return false
}

func isWorkspaceHeadless(pod corev1.Pod) bool {
	val, ok := pod.ObjectMeta.Labels[workspaceType]
	return ok && val == "headless"
}

func isWorkspaceRegular(pod corev1.Pod) bool {
	val, ok := pod.ObjectMeta.Labels[workspaceType]
	return ok && val == "regular"
}

func isValidWorkspaceNode(workspaceType string, node v1.Node) bool {
	if _, ok := node.Labels[workspaceType]; ok {
		return true
	}

	return false
}
