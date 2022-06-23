// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package common

import (
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func CustomizeAnnotation(ctx *RenderContext, component string, typeMeta metav1.TypeMeta, existingAnnotations ...func() map[string]string) map[string]string {
	annotations := make(map[string]string, 0)

	for _, e := range existingAnnotations {
		for k, v := range e() {
			annotations[k] = v
		}
	}

	return annotations
}

func CustomizeEnvvar(ctx *RenderContext, component string, existingEnvvars []corev1.EnvVar) []corev1.EnvVar {
	return existingEnvvars
}

func CustomizeLabel(ctx *RenderContext, component string, typeMeta metav1.TypeMeta, existingLabels ...func() map[string]string) map[string]string {
	labels := DefaultLabels(component)

	for _, e := range existingLabels {
		for k, v := range e() {
			labels[k] = v
		}
	}

	return labels
}
