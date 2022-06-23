// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package common

import (
	"sort"
	"strings"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// CustomOverrideAnnotation override the annotations based upon rules that the config defines
func CustomOverrideAnnotation(ctx *RenderContext, component string, typeMeta metav1.TypeMeta, existingAnnotations ...func() map[string]string) map[string]string {
	// Get the metadata kind in lowercase
	kind := strings.ToLower(typeMeta.Kind)

	annotations := make(map[string]string)

	// Start with any existing annotations
	for _, e := range existingAnnotations {
		for k, v := range e() {
			annotations[k] = v
		}
	}

	if ctx.Config.Components != nil && ctx.Config.Components.Annotations != nil {
		annotationKeys := make([]string, 0, len(*ctx.Config.Components.Annotations))
		for k := range *ctx.Config.Components.Annotations {
			annotationKeys = append(annotationKeys, k)
		}
		// Ensure that "*" comes first
		sort.Strings(annotationKeys)

		for _, annotationKindKey := range annotationKeys {
			annotationKindData := (*ctx.Config.Components.Annotations)[annotationKindKey]

			if annotationKindKey == "*" || annotationKindKey == kind {
				// The key here matches this resource's "kind"
				componentKeys := make([]string, 0, len(annotationKindData))
				for k := range annotationKindData {
					componentKeys = append(componentKeys, k)
				}
				// Ensure that "*" comes first
				sort.Strings(componentKeys)

				for _, componentName := range componentKeys {
					annotationMap := annotationKindData[componentName]
					if componentName == "*" || componentName == component {
						// The key here match this resource's "name" - we can now look to add these to the annotation map
						for k, v := range annotationMap {
							if v == "" {
								// Delete the key/value pair
								delete(annotations, k)
							} else {
								// Add the key/value
								annotations[k] = v
							}
						}
					}
				}
			}
		}
	}

	return annotations
}

func CustomOverrideEnvvar(ctx *RenderContext, component string, existingEnvvars []corev1.EnvVar) []corev1.EnvVar {
	return existingEnvvars
}

func CustomOverrideLabel(ctx *RenderContext, component string, typeMeta metav1.TypeMeta, existingLabels ...func() map[string]string) map[string]string {
	labels := DefaultLabels(component)

	for _, e := range existingLabels {
		for k, v := range e() {
			labels[k] = v
		}
	}

	return labels
}
