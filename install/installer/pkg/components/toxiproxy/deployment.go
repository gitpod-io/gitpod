// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package toxiproxy

import (
	"path/filepath"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

const (
	configmapVolume = "config"
	configMountPath = "/config"

	imageRegistry = "ghcr.io"
	imageName     = "shopify/toxiproxy"
	imageTag      = "2.5.0"
)

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.CustomizeLabel(ctx, Component, common.TypeMetaDeployment)

	configHash, err := common.ObjectHash(configmap(ctx))
	if err != nil {
		return nil, err
	}

	volumes := []corev1.Volume{
		{
			Name: configmapVolume,
			VolumeSource: corev1.VolumeSource{
				ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{
						Name: Component,
					},
				},
			},
		},
	}

	volumeMounts := []corev1.VolumeMount{
		{
			Name:      configmapVolume,
			ReadOnly:  true,
			MountPath: configMountPath,
		},
	}

	return []runtime.Object{
		&appsv1.Deployment{
			TypeMeta: common.TypeMetaDeployment,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    labels,
				Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaDeployment, func() map[string]string {
					return map[string]string{
						common.AnnotationConfigChecksum: configHash,
					}
				}),
			},
			Spec: appsv1.DeploymentSpec{
				Selector: &metav1.LabelSelector{MatchLabels: common.DefaultLabels(Component)},
				Replicas: common.Replicas(ctx, Component),
				Strategy: common.DeploymentStrategy,
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Name:        Component,
						Namespace:   ctx.Namespace,
						Labels:      labels,
						Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaDeployment),
					},
					Spec: corev1.PodSpec{
						Affinity:           common.NodeAffinity(cluster.AffinityLabelMeta),
						ServiceAccountName: Component,
						Volumes:            volumes,
						Containers: []corev1.Container{{
							Name:            Component,
							Image:           ctx.ImageName(imageRegistry, imageName, imageTag),
							Args:            []string{"-config", filepath.Join(configMountPath, configFilename)},
							ImagePullPolicy: corev1.PullIfNotPresent,
							Resources: common.ResourceRequirements(ctx, Component, Component, corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									"cpu":    resource.MustParse("100m"),
									"memory": resource.MustParse("64Mi"),
								},
							}),
							Ports: []corev1.ContainerPort{{
								Name:          HttpPortName,
								ContainerPort: HttpContainerPort,
							}},
							SecurityContext: &corev1.SecurityContext{
								Privileged: pointer.Bool(false),
							},
							Env:          common.CustomizeEnvvar(ctx, Component, common.MergeEnv(common.DefaultEnv(&ctx.Config))),
							VolumeMounts: volumeMounts,
						},
							*common.KubeRBACProxyContainerWithConfig(ctx),
						},
					},
				},
			},
		},
	}, nil
}
