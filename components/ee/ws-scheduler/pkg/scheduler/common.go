// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scheduler

import (
	wsk8s "github.com/gitpod-io/gitpod/common-go/kubernetes"
	corev1 "k8s.io/api/core/v1"
)

func isWorkspace(pod *corev1.Pod) bool {
	val, ok := pod.ObjectMeta.Labels["component"]
	return ok && val == "workspace"
}

func isHeadlessWorkspace(pod *corev1.Pod) bool {
	if !isWorkspace(pod) {
		return false
	}

	val, ok := pod.ObjectMeta.Labels["headless"]
	return ok && val == "true"
}

func isGhostWorkspace(pod *corev1.Pod) bool {
	if !isWorkspace(pod) {
		return false
	}

	val, ok := pod.ObjectMeta.Labels[wsk8s.TypeLabel]
	return ok && val == "ghost"
}

func IsNonGhostWorkspace(pod *corev1.Pod) bool {
	return isWorkspace(pod) &&
		!isGhostWorkspace(pod)
}
