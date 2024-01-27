// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package blobserve

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	dockerregistry "github.com/gitpod-io/gitpod/installer/pkg/components/docker-registry"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/pointer"
)

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.CustomizeLabel(ctx, Component, common.TypeMetaDeployment)

	volumeName := "pull-secret"
	var secretName string
	if pointer.BoolDeref(ctx.Config.ContainerRegistry.InCluster, false) {
		secretName = dockerregistry.BuiltInRegistryAuth
	} else if ctx.Config.ContainerRegistry.External != nil {
		if ctx.Config.ContainerRegistry.External.Certificate != nil {
			secretName = ctx.Config.ContainerRegistry.External.Certificate.Name
		}
	} else {
		return nil, fmt.Errorf("%s: invalid container registry config", Component)
	}

	var hashObj []runtime.Object
	if objs, err := configmap(ctx); err != nil {
		return nil, err
	} else {
		hashObj = append(hashObj, objs...)
	}

	if objs, err := common.DockerRegistryHash(ctx); err != nil {
		return nil, err
	} else {
		hashObj = append(hashObj, objs...)
	}

	configHash, err := common.ObjectHash(hashObj, nil)
	if err != nil {
		return nil, err
	}

	return []runtime.Object{
		&appsv1.Deployment{
			TypeMeta: common.TypeMetaDeployment,
			ObjectMeta: metav1.ObjectMeta{
				Name:        Component,
				Namespace:   ctx.Namespace,
				Labels:      labels,
				Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaDeployment),
			},
			Spec: appsv1.DeploymentSpec{
				Selector: &metav1.LabelSelector{MatchLabels: common.DefaultLabels(Component)},
				Replicas: common.Replicas(ctx, Component),
				Strategy: common.DeploymentStrategy,
				Template: corev1.PodTemplateSpec{
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
					Spec: corev1.PodSpec{
						Affinity:                  cluster.WithNodeAffinityHostnameAntiAffinity(Component, cluster.AffinityLabelIDE),
						TopologySpreadConstraints: cluster.WithHostnameTopologySpread(Component),
						ServiceAccountName:        Component,
						EnableServiceLinks:        pointer.Bool(false),
						Volumes: []corev1.Volume{
							{
								Name:         "cache",
								VolumeSource: corev1.VolumeSource{EmptyDir: &corev1.EmptyDirVolumeSource{}},
							}, {
								Name: "config",
								VolumeSource: corev1.VolumeSource{
									ConfigMap: &corev1.ConfigMapVolumeSource{
										LocalObjectReference: corev1.LocalObjectReference{Name: Component},
									},
								},
							}, {
								Name: volumeName,
								VolumeSource: corev1.VolumeSource{
									Secret: &corev1.SecretVolumeSource{
										SecretName: secretName,
										Items:      []corev1.KeyToPath{{Key: ".dockerconfigjson", Path: "pull-secret.json"}},
									},
								},
							},
							common.CAVolume(),
						},
						Containers: []corev1.Container{{
							Name:            Component,
							Args:            []string{"run", "/mnt/config/config.json"},
							Image:           ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.Blobserve.Version),
							ImagePullPolicy: corev1.PullIfNotPresent,
							Ports: []corev1.ContainerPort{{
								Name:          ServicePortName,
								ContainerPort: ContainerPort,
							}},
							Resources: common.ResourceRequirements(ctx, Component, Component, corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									"cpu":    resource.MustParse("100m"),
									"memory": resource.MustParse("32Mi"),
								},
							}),
							SecurityContext: &corev1.SecurityContext{
								Privileged: pointer.Bool(false),
								RunAsUser:  pointer.Int64(1000),
							},
							Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
								common.DefaultEnv(&ctx.Config),
								common.WorkspaceTracingEnv(ctx, Component),
							)),
							VolumeMounts: []corev1.VolumeMount{
								{
									Name:      "config",
									MountPath: "/mnt/config",
									ReadOnly:  true,
								}, {
									Name:      "cache",
									MountPath: "/mnt/cache",
								}, {
									Name:      volumeName,
									MountPath: "/mnt/pull-secret",
								},
								common.CAVolumeMount(),
							},

							ReadinessProbe: &corev1.Probe{
								ProbeHandler: corev1.ProbeHandler{
									HTTPGet: &corev1.HTTPGetAction{
										Path: "/ready",
										Port: intstr.IntOrString{IntVal: ReadinessPort},
									},
								},
								InitialDelaySeconds: 5,
								PeriodSeconds:       5,
								TimeoutSeconds:      2,
								SuccessThreshold:    1,
								FailureThreshold:    3,
							},
							LivenessProbe: &corev1.Probe{
								ProbeHandler: corev1.ProbeHandler{
									HTTPGet: &corev1.HTTPGetAction{
										Path: "/live",
										Port: intstr.IntOrString{IntVal: ReadinessPort},
									},
								},
								InitialDelaySeconds: 5,
								PeriodSeconds:       10,
								TimeoutSeconds:      2,
								SuccessThreshold:    1,
								FailureThreshold:    3,
							},
						}, *common.KubeRBACProxyContainer(ctx)},
					},
				},
			},
		},
	}, nil
}
