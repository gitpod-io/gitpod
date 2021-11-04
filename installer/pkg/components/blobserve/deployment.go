// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package blobserve

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	dockerregistry "github.com/gitpod-io/gitpod/installer/pkg/components/docker-registry"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(Component)

	var hashObj []runtime.Object
	if objs, err := configmap(ctx); err != nil {
		return nil, err
	} else {
		hashObj = append(hashObj, objs...)
	}

	volumes := []corev1.Volume{{
		Name:         "cache",
		VolumeSource: corev1.VolumeSource{EmptyDir: &corev1.EmptyDirVolumeSource{}},
	}, {
		Name: "config",
		VolumeSource: corev1.VolumeSource{
			ConfigMap: &corev1.ConfigMapVolumeSource{
				LocalObjectReference: corev1.LocalObjectReference{Name: Component},
			},
		},
	}}

	volumeMounts := []corev1.VolumeMount{
		{
			Name:      "config",
			MountPath: "/mnt/config",
			ReadOnly:  true,
		}, {
			Name:      "cache",
			MountPath: "/mnt/cache",
		},
	}

	if pointer.BoolDeref(ctx.Config.ContainerRegistry.InCluster, false) {
		volumeName := "pull-secret"
		volumes = append(volumes, corev1.Volume{
			Name: volumeName,
			VolumeSource: corev1.VolumeSource{Secret: &corev1.SecretVolumeSource{
				SecretName: dockerregistry.BuiltInRegistryAuth,
			}},
		})
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      volumeName,
			MountPath: "/mnt/pull-secret.json",
			SubPath:   ".dockerconfigjson",
		})

		if objs, err := common.DockerRegistryHash(ctx); err != nil {
			return nil, err
		} else {
			hashObj = append(hashObj, objs...)
		}
	}

	configHash, err := common.ObjectHash(hashObj, nil)
	if err != nil {
		return nil, err
	}

	return []runtime.Object{
		&appsv1.Deployment{
			TypeMeta: common.TypeMetaDeployment,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    labels,
			},
			Spec: appsv1.DeploymentSpec{
				Selector: &metav1.LabelSelector{MatchLabels: labels},
				Replicas: pointer.Int32(1),
				Strategy: common.DeploymentStrategy,
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Name:      Component,
						Namespace: ctx.Namespace,
						Labels:    labels,
						Annotations: map[string]string{
							common.AnnotationConfigChecksum: configHash,
						},
					},
					Spec: corev1.PodSpec{
						Affinity:           &corev1.Affinity{},
						ServiceAccountName: Component,
						EnableServiceLinks: pointer.Bool(false),
						Volumes:            volumes,
						Containers: []corev1.Container{{
							Name:            Component,
							Args:            []string{"run", "-v", "/mnt/config/config.json"},
							Image:           common.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.Blobserve.Version),
							ImagePullPolicy: corev1.PullIfNotPresent,
							Ports: []corev1.ContainerPort{{
								Name:          ServicePortName,
								ContainerPort: ContainerPort,
							}},
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									"cpu":    resource.MustParse("100m"),
									"memory": resource.MustParse("32Mi"),
								},
							},
							SecurityContext: &corev1.SecurityContext{
								Privileged: pointer.Bool(false),
								RunAsUser:  pointer.Int64(1000),
							},
							Env: common.MergeEnv(
								common.DefaultEnv(&ctx.Config),
								common.TracingEnv(&ctx.Config),
							),
							VolumeMounts: volumeMounts,
						}, *common.KubeRBACProxyContainer()},
					},
				},
			},
		},
	}, nil
}
