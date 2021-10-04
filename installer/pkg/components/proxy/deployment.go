// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"

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

	var prometheusPort corev1.ContainerPort
	// todo(sje): make conditional (default to false)
	prometheusPort = corev1.ContainerPort{
		ContainerPort: PrometheusPort,
		Name:          MetricsContainerName,
	}

	// todo(sje): make conditional if registry enabled
	var registryVolumes []corev1.Volume
	var registryVolumeMounts []corev1.VolumeMount
	registryVolumes = []corev1.Volume{{
		Name: RegistryAuthSecret,
		VolumeSource: corev1.VolumeSource{
			Secret: &corev1.SecretVolumeSource{
				SecretName: RegistryAuthSecret,
			},
		},
	}, {
		Name: RegistryTLSCertSecret,
		VolumeSource: corev1.VolumeSource{
			Secret: &corev1.SecretVolumeSource{
				SecretName: RegistryTLSCertSecret,
			},
		},
	}}
	registryVolumeMounts = []corev1.VolumeMount{{
		Name:      RegistryAuthSecret,
		MountPath: "/etc/caddy/registry-auth",
	}, {
		Name:      RegistryTLSCertSecret,
		MountPath: "/etc/caddy/registry-certs",
	}}

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
						Affinity:                      &corev1.Affinity{},
						PriorityClassName:             "system-node-critical",
						ServiceAccountName:            Component,
						EnableServiceLinks:            pointer.Bool(false),
						DNSPolicy:                     "ClusterFirst",
						RestartPolicy:                 "Always",
						TerminationGracePeriodSeconds: pointer.Int64(30),
						SecurityContext: &corev1.PodSecurityContext{
							RunAsNonRoot: pointer.Bool(false),
						},
						Volumes: append([]corev1.Volume{{
							Name: "vhosts",
							VolumeSource: corev1.VolumeSource{
								ConfigMap: &corev1.ConfigMapVolumeSource{
									LocalObjectReference: corev1.LocalObjectReference{Name: fmt.Sprintf("%s-config", Component)},
								},
							},
						}, {
							Name: "config-certificates",
							VolumeSource: corev1.VolumeSource{
								Secret: &corev1.SecretVolumeSource{
									SecretName: ctx.Config.Certificate.Name,
								},
							},
						}}, registryVolumes...),
						InitContainers: []corev1.Container{{
							Name:            "sysctl",
							Image:           InitContainerImage,
							ImagePullPolicy: corev1.PullIfNotPresent,
							SecurityContext: &corev1.SecurityContext{
								Privileged: pointer.Bool(true),
							},
							Command: []string{
								"sh",
								"-c",
								"sysctl -w net.core.somaxconn=32768; sysctl -w net.ipv4.ip_local_port_range='1024 65000'",
							},
						}},
						Containers: []corev1.Container{{
							Name:            "kube-rbac-proxy",
							Image:           KubeRBACProxyImage,
							ImagePullPolicy: corev1.PullIfNotPresent,
							Args: []string{
								"--v=10",
								"--logtostderr",
								fmt.Sprintf("--insecure-listen-address=[$(IP)]:%d", PrometheusPort),
								"--upstream=http://127.0.0.1:9545/",
							},
							Env: []corev1.EnvVar{{
								Name: "IP",
								ValueFrom: &corev1.EnvVarSource{
									FieldRef: &corev1.ObjectFieldSelector{
										APIVersion: "v1",
										FieldPath:  "status.podIP",
									},
								},
							}},
							Ports: []corev1.ContainerPort{{
								ContainerPort: PrometheusPort,
								Name:          MetricsContainerName,
								Protocol:      *common.TCPProtocol,
							}},
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									"cpu":    resource.MustParse("1m"),
									"memory": resource.MustParse("30Mi"),
								},
							},
							SecurityContext: &corev1.SecurityContext{
								RunAsGroup:   pointer.Int64(65532),
								RunAsNonRoot: pointer.Bool(true),
								RunAsUser:    pointer.Int64(65532),
							},
						}, {
							Name:            Component,
							Image:           common.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.Proxy.Version),
							ImagePullPolicy: corev1.PullIfNotPresent,
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									"cpu":    resource.MustParse("100m"),
									"memory": resource.MustParse("200Mi"),
								},
							},
							Ports: []corev1.ContainerPort{{
								ContainerPort: ContainerHTTPPort,
								Name:          "http",
							}, {
								ContainerPort: ContainerHTTPSPort,
								Name:          "https",
							}, prometheusPort},
							SecurityContext: &corev1.SecurityContext{
								Privileged: pointer.Bool(false),
							},
							ReadinessProbe: &corev1.Probe{
								Handler: corev1.Handler{
									HTTPGet: &corev1.HTTPGetAction{
										Path: "/ready",
										Port: intstr.IntOrString{IntVal: ReadinessPort},
									},
								},
								InitialDelaySeconds: 5,
								PeriodSeconds:       5,
								TimeoutSeconds:      1,
								SuccessThreshold:    1,
								FailureThreshold:    3,
							},
							VolumeMounts: append([]corev1.VolumeMount{{
								Name:      "vhosts",
								MountPath: "/etc/caddy/vhosts",
							}, {
								Name:      "config-certificates",
								MountPath: "/etc/caddy/certificates",
							}}, registryVolumeMounts...),
							Env: common.MergeEnv(
								common.DefaultEnv(&ctx.Config),
								[]corev1.EnvVar{{
									Name:  "PROXY_DOMAIN",
									Value: ctx.Config.Domain,
								}},
							),
						}},
					},
				},
			},
		},
	}, nil
}
