// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsproxy

import (
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
	labels := common.DefaultLabels(Component)

	var certSecretsVolume corev1.Volume
	var certSecretsVolumeMount corev1.VolumeMount
	if ctx.Config.Certificate.Name != "" {
		certSecretsVolume = corev1.Volume{
			Name: "config-certificates",
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: ctx.Config.Certificate.Name,
				},
			},
		}

		certSecretsVolumeMount = corev1.VolumeMount{
			Name:      "config-certificates",
			MountPath: "/mnt/certificates",
		}
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
				Selector: &metav1.LabelSelector{
					MatchLabels: map[string]string{"Component": Component},
				},
				// todo(sje): receive config value
				Replicas: pointer.Int32(1),
				Strategy: common.DeploymentStrategy,
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Name:      Component,
						Namespace: ctx.Namespace,
						Labels:    labels,
					},
					Spec: corev1.PodSpec{
						PriorityClassName:  "system-node-critical",
						Affinity:           &corev1.Affinity{},
						EnableServiceLinks: pointer.Bool(false),
						ServiceAccountName: Component,
						SecurityContext: &corev1.PodSecurityContext{
							RunAsUser: pointer.Int64(31002),
						},
						Volumes: []corev1.Volume{{
							Name: "config",
							VolumeSource: corev1.VolumeSource{
								ConfigMap: &corev1.ConfigMapVolumeSource{
									LocalObjectReference: corev1.LocalObjectReference{Name: Component},
								},
							},
						}, {
							Name: "ws-manager-client-tls-certs",
							VolumeSource: corev1.VolumeSource{
								Secret: &corev1.SecretVolumeSource{
									SecretName: wsmanager.TLSSecretNameClient,
								},
							},
						}, certSecretsVolume},
						Containers: []corev1.Container{{
							Name:            Component,
							Args:            []string{"run", "-v", "/config/config.json"},
							Image:           common.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.WSProxy.Version),
							ImagePullPolicy: corev1.PullIfNotPresent,
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									"cpu":    resource.MustParse("100m"),
									"memory": resource.MustParse("32Mi"),
								},
							},
							Ports: []corev1.ContainerPort{{
								Name:          "httpProxy",
								ContainerPort: HTTPProxyPort,
							}, {
								Name:          "httpsProxy",
								ContainerPort: HTTPSProxyPort,
							}, {
								Name:          "metrics",
								ContainerPort: MetricsPort,
							}},
							SecurityContext: &corev1.SecurityContext{
								Privileged: pointer.Bool(false),
							},
							Env: common.MergeEnv(
								common.DefaultEnv(&ctx.Config),
								common.TracingEnv(&ctx.Config),
							),
							ReadinessProbe: &corev1.Probe{
								InitialDelaySeconds: int32(2),
								PeriodSeconds:       int32(5),
								FailureThreshold:    int32(10),
								Handler: corev1.Handler{
									HTTPGet: &corev1.HTTPGetAction{
										Path: "/",
										Port: intstr.IntOrString{IntVal: ProbePort},
									},
								},
							},
							LivenessProbe: &corev1.Probe{
								InitialDelaySeconds: int32(2),
								PeriodSeconds:       int32(5),
								FailureThreshold:    int32(10),
								SuccessThreshold:    int32(1),
								TimeoutSeconds:      int32(2),
								Handler: corev1.Handler{
									HTTPGet: &corev1.HTTPGetAction{
										Path: "/",
										Port: intstr.IntOrString{IntVal: ProbePort},
									},
								},
							},
							VolumeMounts: []corev1.VolumeMount{{
								Name:      "config",
								MountPath: "/config",
								ReadOnly:  true,
							}, {
								Name:      "ws-manager-client-tls-certs",
								MountPath: "/ws-manager-client-tls-certs",
								ReadOnly:  true,
							}, certSecretsVolumeMount},
						}},
					},
				},
			},
		},
	}, nil
}
