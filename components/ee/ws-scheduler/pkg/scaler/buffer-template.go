// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scaler

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
	res "k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// renderBufferPod renders a buffer pod using the given config
func renderBufferPod(config Configuration, nameSuffix string, staticLabels map[string]string) *corev1.Pod {
	memoryVolumeBytes := config.BufferRAMRequest.Value() * int64(config.SlotFactor)
	memoryRequestMib := res.NewQuantity(memoryVolumeBytes, res.DecimalSI)

	terminationGracePeriodSeconds := int64(1)
	bfalse := false
	btrue := true
	gitpodUser := int64(33333)
	gitpodGroup := int64(33333)

	imagePullSecrets := make([]corev1.LocalObjectReference, len(config.PullSecrets))
	for _, secretName := range config.PullSecrets {
		imagePullSecrets = append(imagePullSecrets, corev1.LocalObjectReference{
			Name: secretName,
		})
	}

	labels := make(map[string]string)
	for k, v := range staticLabels {
		labels[k] = v
	}
	labels["stage"] = config.Stage

	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Annotations: map[string]string{
				// The scaling buffer should NOT prevent the cluster autoscaler to scale down the node
				"cluster-autoscaler.kubernetes.io/safe-to-evict": "true",
			},
			Labels: labels,
			Name:   fmt.Sprintf("scaling-buffer-%s", nameSuffix),
		},
		Spec: corev1.PodSpec{
			// Run once and be 'Completed' afterwards
			RestartPolicy:                 "Never",
			SchedulerName:                 config.SchedulerName,
			ServiceAccountName:            "workspace", // Needed for theia/workspace containers
			TerminationGracePeriodSeconds: &terminationGracePeriodSeconds,
			Containers: []corev1.Container{
				corev1.Container{
					Name:            "buffer",
					Image:           "gitpod/workspace-full:latest",
					ImagePullPolicy: "Always",
					Command: []string{
						"/bin/sh",
						"-c",
						`sleep ${config.staticRunSeconds}; exit 0;`,
					},
					Resources: corev1.ResourceRequirements{
						Requests: corev1.ResourceList{
							"memory": *memoryRequestMib,
						},
					},
					SecurityContext: &corev1.SecurityContext{
						AllowPrivilegeEscalation: &bfalse,
						RunAsUser:                &gitpodUser,
						RunAsGroup:               &gitpodGroup,
						Privileged:               &bfalse,
						RunAsNonRoot:             &btrue,
					},
				},
			},
			ImagePullSecrets: imagePullSecrets,
		},
	}
}
