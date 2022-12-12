// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registry_credential

import (
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
)

func jobSpec(ctx *common.RenderContext, objectMeta metav1.ObjectMeta) batchv1.JobSpec {
	return batchv1.JobSpec{
		BackoffLimit: pointer.Int32(10),
		Template: corev1.PodTemplateSpec{
			ObjectMeta: objectMeta,
			Spec: corev1.PodSpec{
				RestartPolicy:      corev1.RestartPolicyOnFailure,
				ServiceAccountName: Component,
				Containers: []corev1.Container{
					{
						Name:            Component,
						Args:            []string{"ecr-update", "/config/config.json"},
						Image:           ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.RegistryCredential.Version),
						ImagePullPolicy: corev1.PullIfNotPresent,
						SecurityContext: &corev1.SecurityContext{
							AllowPrivilegeEscalation: pointer.Bool(false),
						},
						VolumeMounts: []corev1.VolumeMount{
							{
								Name:      "config",
								MountPath: "/config",
								ReadOnly:  true,
							},
						},
					},
				},
				Volumes: []corev1.Volume{
					{
						Name: "config",
						VolumeSource: corev1.VolumeSource{
							ConfigMap: &corev1.ConfigMapVolumeSource{
								LocalObjectReference: corev1.LocalObjectReference{Name: Component},
							},
						},
					},
				},
			},
		},
	}
}

func job(ctx *common.RenderContext) ([]runtime.Object, error) {
	if !isAWSRegistry(ctx) {
		return []runtime.Object{}, nil
	}

	objectMeta := metav1.ObjectMeta{
		Name:      Component,
		Namespace: ctx.Namespace,
		Labels:    common.DefaultLabels(Component),
	}

	return []runtime.Object{
		&batchv1.Job{
			TypeMeta:   common.TypeMetaBatchJob,
			ObjectMeta: objectMeta,
			Spec:       jobSpec(ctx, objectMeta),
		},
	}, nil
}
