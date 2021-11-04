// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package image_builder_mk3

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	dockerregistry "github.com/gitpod-io/gitpod/installer/pkg/components/docker-registry"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager"

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
	if objs, err := secret(ctx); err != nil {
		return nil, err
	} else {
		hashObj = append(hashObj, objs...)
	}
	configHash, err := common.ObjectHash(hashObj, nil)
	if err != nil {
		return nil, err
	}

	var volumes []corev1.Volume
	var volumeMounts []corev1.VolumeMount

	if pointer.BoolDeref(ctx.Config.ContainerRegistry.InCluster, false) {
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      "pull-secret",
			MountPath: PullSecretFile,
			SubPath:   ".dockerconfigjson",
		})
		volumes = append(volumes, corev1.Volume{
			Name: "pull-secret",
			VolumeSource: corev1.VolumeSource{Secret: &corev1.SecretVolumeSource{
				SecretName: dockerregistry.BuiltInRegistryAuth,
			}},
		})
	} else if ctx.Config.ContainerRegistry.External != nil {
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      "pull-secret",
			MountPath: PullSecretFile,
			SubPath:   "dockerconfig.json",
		})
		volumes = append(volumes, corev1.Volume{
			Name: "pull-secret",
			VolumeSource: corev1.VolumeSource{Secret: &corev1.SecretVolumeSource{
				SecretName: ctx.Config.ContainerRegistry.External.Credentials.Name,
			}},
		})
	}

	return []runtime.Object{&appsv1.Deployment{
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
					Affinity:                      &corev1.Affinity{},
					ServiceAccountName:            Component,
					EnableServiceLinks:            pointer.Bool(false),
					DNSPolicy:                     "ClusterFirst",
					RestartPolicy:                 "Always",
					TerminationGracePeriodSeconds: pointer.Int64(30),
					Volumes: append([]corev1.Volume{
						{
							Name: "configuration",
							VolumeSource: corev1.VolumeSource{
								ConfigMap: &corev1.ConfigMapVolumeSource{
									LocalObjectReference: corev1.LocalObjectReference{Name: fmt.Sprintf("%s-config", Component)},
								},
							},
						}, {
							Name: "authkey",
							VolumeSource: corev1.VolumeSource{
								Secret: &corev1.SecretVolumeSource{
									SecretName: fmt.Sprintf("%s-authkey", Component),
								},
							},
						}, {
							Name: "wsman-tls-certs",
							VolumeSource: corev1.VolumeSource{
								Secret: &corev1.SecretVolumeSource{
									SecretName: wsmanager.TLSSecretNameClient,
								},
							},
						},
					}, volumes...),
					Containers: []corev1.Container{
						{
							Name:            Component,
							Image:           common.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.ImageBuilderMk3.Version),
							ImagePullPolicy: corev1.PullIfNotPresent,
							Args: []string{
								"run",
								"--config",
								"/config/image-builder.json",
							},
							Env: common.MergeEnv(
								common.DefaultEnv(&ctx.Config),
								common.TracingEnv(&ctx.Config),
							),
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									"cpu":    resource.MustParse("100m"),
									"memory": resource.MustParse("200Mi"),
								},
							},
							Ports: []corev1.ContainerPort{{
								ContainerPort: RPCPort,
								Name:          RPCPortName,
							}},
							SecurityContext: &corev1.SecurityContext{
								Privileged: pointer.Bool(false),
								RunAsUser:  pointer.Int64(33333),
							},
							VolumeMounts: append([]corev1.VolumeMount{
								{
									Name:      "configuration",
									MountPath: "/config/image-builder.json",
									SubPath:   "image-builder.json",
								},
								{
									Name:      "authkey",
									MountPath: "/config/authkey",
									SubPath:   "keyfile",
								},
								{
									Name:      "wsman-tls-certs",
									MountPath: "/wsman-certs",
									ReadOnly:  true,
								},
							}, volumeMounts...),
						},
						*common.KubeRBACProxyContainer(),
					},
				},
			},
		},
	}}, nil
}
