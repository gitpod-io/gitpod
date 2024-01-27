// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

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
	// Order is important to support GitOps workflows
	output := make([]corev1.EnvVar, 0)
	customizeOrder := make([]string, 0)
	existing := make(map[string]corev1.EnvVar, 0)

	// Use a map so we can remove duplicated keys
	envvars := make(map[string]corev1.EnvVar, 0)

	// Get existing as a map so we don't override these
	for _, e := range existingEnvvars {
		// Ensure that existing envvars are first
		customizeOrder = append(customizeOrder, e.Name)
		existing[e.Name] = e
		envvars[e.Name] = e
	}

	// Apply the customizations - envvars only need to match name
	if ctx.Config.Customization != nil {
		for _, customization := range *ctx.Config.Customization {
			if customization.Metadata.Name == component || customization.Metadata.Name == "*" {
				for _, e := range customization.Spec.Env {
					_, inExisting := existing[e.Name]
					_, inEnvvars := envvars[e.Name]

					if !inExisting {
						if !inEnvvars {
							// Only interested in name
							customizeOrder = append(customizeOrder, e.Name)
						}
						// Set the value if not in existing envvars
						envvars[e.Name] = e
					}

				}
			}
		}
	}

	// Convert map back slice
	for _, e := range customizeOrder {
		output = append(output, envvars[e])
	}
	return output
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
