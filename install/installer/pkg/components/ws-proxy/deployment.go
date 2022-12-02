// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsproxy

import (
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"

	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager"

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

	configHash, err := common.ObjectHash(configmap(ctx))
	if err != nil {
		return nil, err
	}

	var volumes []corev1.Volume
	var volumeMounts []corev1.VolumeMount
	if ctx.Config.Certificate.Name != "" {
		volumes = append(volumes, corev1.Volume{
			Name: "config-certificates",
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: ctx.Config.Certificate.Name,
				},
			},
		})

		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      "config-certificates",
			MountPath: "/mnt/certificates",
		})
	}
	if ctx.Config.SSHGatewayHostKey != nil {
		volumes = append(volumes, corev1.Volume{
			Name: "host-key",
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: ctx.Config.SSHGatewayHostKey.Name,
				},
			},
		})

		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      "host-key",
			MountPath: "/mnt/host-key",
		})
	}

	podSpec := corev1.PodSpec{
		PriorityClassName: common.SystemNodeCritical,
		Affinity:          common.NodeAffinity(cluster.AffinityLabelServices),
		TopologySpreadConstraints: []corev1.TopologySpreadConstraint{
			{
				LabelSelector:     &metav1.LabelSelector{MatchLabels: common.DefaultLabels(Component)},
				MaxSkew:           1,
				TopologyKey:       "kubernetes.io/hostname",
				WhenUnsatisfiable: corev1.DoNotSchedule,
			},
		},
		EnableServiceLinks: pointer.Bool(false),
		ServiceAccountName: Component,
		SecurityContext: &corev1.PodSecurityContext{
			RunAsUser: pointer.Int64(31002),
		},
		Volumes: append([]corev1.Volume{
			{
				Name: "config",
				VolumeSource: corev1.VolumeSource{
					ConfigMap: &corev1.ConfigMapVolumeSource{
						LocalObjectReference: corev1.LocalObjectReference{Name: Component},
					},
				},
			},
			{
				Name: "ws-manager-client-tls-certs",
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
				Args:            []string{"run", "/config/config.json"},
				Image:           ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.WSProxy.Version),
				ImagePullPolicy: corev1.PullIfNotPresent,
				Resources: common.ResourceRequirements(ctx, Component, Component, corev1.ResourceRequirements{
					Requests: corev1.ResourceList{
						"cpu":    resource.MustParse("100m"),
						"memory": resource.MustParse("32Mi"),
					},
				}),
				Ports: []corev1.ContainerPort{
					{
						Name:          HTTPProxyPortName,
						ContainerPort: HTTPProxyPort,
					},
					{
						Name:          HTTPSProxyPortName,
						ContainerPort: HTTPSProxyPort,
					},
					{
						Name:          baseserver.BuiltinMetricsPortName,
						ContainerPort: baseserver.BuiltinMetricsPort,
					},
				},
				SecurityContext: &corev1.SecurityContext{
					Privileged: pointer.Bool(false),
				},
				Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
					common.DefaultEnv(&ctx.Config),
					common.WorkspaceTracingEnv(ctx, Component),
					common.AnalyticsEnv(&ctx.Config),
				)),
				ReadinessProbe: &corev1.Probe{
					InitialDelaySeconds: int32(2),
					PeriodSeconds:       int32(5),
					FailureThreshold:    int32(10),
					ProbeHandler: corev1.ProbeHandler{
						HTTPGet: &corev1.HTTPGetAction{
							Path: "/readyz",
							Port: intstr.IntOrString{IntVal: ReadinessPort},
						},
					},
				},
				LivenessProbe: &corev1.Probe{
					InitialDelaySeconds: int32(2),
					PeriodSeconds:       int32(5),
					FailureThreshold:    int32(10),
					SuccessThreshold:    int32(1),
					TimeoutSeconds:      int32(2),
					ProbeHandler: corev1.ProbeHandler{
						HTTPGet: &corev1.HTTPGetAction{
							Path: "/healthz",
							Port: intstr.IntOrString{IntVal: ReadinessPort},
						},
					},
				},
				VolumeMounts: append([]corev1.VolumeMount{
					{
						Name:      "config",
						MountPath: "/config",
						ReadOnly:  true,
					},
					{
						Name:      "ws-manager-client-tls-certs",
						MountPath: "/ws-manager-client-tls-certs",
						ReadOnly:  true,
					},
				}, volumeMounts...),
			},
			*common.KubeRBACProxyContainer(ctx),
		},
	}

	if vol, mnt, env, ok := common.CustomCACertVolume(ctx); ok {
		podSpec.Volumes = append(podSpec.Volumes, *vol)
		pod := podSpec.Containers[0]
		pod.VolumeMounts = append(pod.VolumeMounts, *mnt)
		pod.Env = append(pod.Env, env...)
		podSpec.Containers[0] = pod
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
					Spec: podSpec,
				},
			},
		},
	}, nil
}
