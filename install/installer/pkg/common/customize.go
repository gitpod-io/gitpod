// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package common

import (
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type CustomizationType string

const (
	CustomizationTypeAnnotation CustomizationType = "annotation"
	CustomizationTypeLabel      CustomizationType = "label"
)

func extractCustomizations(ctx *RenderContext, name string, typeMeta metav1.TypeMeta, customizationType CustomizationType) map[string]string {
	customizations := make(map[string]string, 0)

	if ctx.Config.Customization != nil {
		for _, customization := range *ctx.Config.Customization {
			// Match the apiVersion, kind and name - nested to make more readable. Must match value or "*"
			if customization.APIVersion == typeMeta.APIVersion || customization.APIVersion == "*" {
				// Matches apiVersion
				if customization.Kind == typeMeta.Kind || customization.Kind == "*" {
					// Matches kind
					if customization.Metadata.Name == name || customization.Metadata.Name == "*" {
						// Matches the name
						if customizationType == CustomizationTypeAnnotation {
							// Annotations
							customizations = mergeCustomizations(customizations, customization.Metadata.Annotations)
						}
						if customizationType == CustomizationTypeLabel {
							// Labels
							customizations = mergeCustomizations(customizations, customization.Metadata.Labels)
						}
					}
				}
			}
		}
	}

	return customizations
}

func mergeCustomizations(customizations map[string]string, input map[string]string) map[string]string {
	for k, v := range input {
		customizations[k] = v
	}

	return customizations
}

func CustomizeAnnotation(ctx *RenderContext, component string, typeMeta metav1.TypeMeta, existingAnnotations ...func() map[string]string) map[string]string {
	annotations := make(map[string]string, 0)

	// Apply the customizations
	for k, v := range extractCustomizations(ctx, component, typeMeta, CustomizationTypeAnnotation) {
		annotations[k] = v
	}

	// Always apply existing annotations
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

	// Apply the customizations
	for k, v := range extractCustomizations(ctx, component, typeMeta, CustomizationTypeLabel) {
		labels[k] = v
	}

	// Always apply existing labels
	for _, e := range existingLabels {
		for k, v := range e() {
			labels[k] = v
		}
	}

	return labels
}
