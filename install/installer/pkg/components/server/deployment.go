// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"encoding/base64"
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager"
	wsmanagerbridge "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager-bridge"
	configv1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(Component)

	configHash, err := common.ObjectHash(configmap(ctx))
	if err != nil {
		return nil, err
	}

	// Convert to a JSON string
	fc, err := common.ToJSONString(wsmanagerbridge.WSManagerList(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to marshal server.WorkspaceManagerList config: %w", err)
	}
	wsmanCfgManager := base64.StdEncoding.EncodeToString(fc)

	volumes := make([]corev1.Volume, 0)
	volumeMounts := make([]corev1.VolumeMount, 0)
	if ctx.Config.License != nil {
		volumes = append(volumes, corev1.Volume{
			Name: "gitpod-license-key",
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: ctx.Config.License.Name,
				},
			},
		})

		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      "gitpod-license-key",
			MountPath: licenseFilePath,
			SubPath:   "license",
		})
	}

	if len(ctx.Config.AuthProviders) > 0 {
		for i, provider := range ctx.Config.AuthProviders {
			volumeName := fmt.Sprintf("auth-provider-%d", i)
			volumes = append(volumes, corev1.Volume{
				Name: volumeName,
				VolumeSource: corev1.VolumeSource{
					Secret: &corev1.SecretVolumeSource{
						SecretName: provider.Name,
					},
				},
			})

			volumeMounts = append(volumeMounts, corev1.VolumeMount{
				Name:      volumeName,
				MountPath: fmt.Sprintf("%s/%s", authProviderFilePath, provider.Name),
				ReadOnly:  true,
			})
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
				Selector: &metav1.LabelSelector{MatchLabels: labels},
				// todo(sje): receive config value
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
						Affinity:           common.Affinity(cluster.AffinityLabelMeta),
						PriorityClassName:  common.SystemNodeCritical,
						ServiceAccountName: Component,
						EnableServiceLinks: pointer.Bool(false),
						// todo(sje): conditionally add github-app-cert-secret in
						// todo(sje): do we need to cater for serverContainer.volumeMounts from values.yaml?
						Volumes: append(
							[]corev1.Volume{
								{
									Name: "config",
									VolumeSource: corev1.VolumeSource{
										ConfigMap: &corev1.ConfigMapVolumeSource{
											LocalObjectReference: corev1.LocalObjectReference{Name: fmt.Sprintf("%s-config", Component)},
										},
									},
								},
								{
									Name: "ide-config",
									VolumeSource: corev1.VolumeSource{
										ConfigMap: &corev1.ConfigMapVolumeSource{
											LocalObjectReference: corev1.LocalObjectReference{Name: fmt.Sprintf("%s-ide-config", Component)},
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
							},
							volumes...,
						),
						InitContainers: []corev1.Container{*common.DatabaseWaiterContainer(ctx), *common.MessageBusWaiterContainer(ctx)},
						Containers: []corev1.Container{{
							Name:            Component,
							Image:           common.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.Server.Version),
							ImagePullPolicy: corev1.PullIfNotPresent,
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									"cpu":    resource.MustParse("200m"),
									"memory": resource.MustParse("200Mi"),
								},
							},
							SecurityContext: &corev1.SecurityContext{
								Privileged: pointer.Bool(false),
								RunAsUser:  pointer.Int64(31001),
							},
							Ports: []corev1.ContainerPort{{
								Name:          ContainerPortName,
								ContainerPort: ContainerPort,
							}, {
								Name:          PrometheusPortName,
								ContainerPort: PrometheusPort,
							}},
							// todo(sje): do we need to cater for serverContainer.env from values.yaml?
							Env: common.MergeEnv(
								common.DefaultEnv(&ctx.Config),
								common.DatabaseEnv(&ctx.Config),
								common.TracingEnv(ctx),
								common.AnalyticsEnv(&ctx.Config),
								common.MessageBusEnv(&ctx.Config),
								[]corev1.EnvVar{
									{
										Name:  "CONFIG_PATH",
										Value: "/config/config.json",
									},
									func() corev1.EnvVar {
										envvar := corev1.EnvVar{
											Name: "GITPOD_LICENSE_TYPE",
										}

										if ctx.Config.License == nil {
											envvar.Value = string(configv1.LicensorTypeGitpod)
										} else {
											envvar.ValueFrom = &corev1.EnvVarSource{
												SecretKeyRef: &corev1.SecretKeySelector{
													LocalObjectReference: corev1.LocalObjectReference{Name: ctx.Config.License.Name},
													Key:                  "type",
													Optional:             pointer.Bool(true),
												},
											}
										}

										return envvar
									}(),
									{
										Name:  "IDE_CONFIG_PATH",
										Value: "/ide-config/config.json",
									},
									{
										Name:  "NODE_ENV",
										Value: "production", // todo(sje): will we need to change this?
									},
									{
										Name:  "SHLVL",
										Value: "1",
									},
									{
										Name:  "WSMAN_CFG_MANAGERS",
										Value: wsmanCfgManager,
									},
								},
							),
							// todo(sje): conditionally add github-app-cert-secret in
							// todo(sje): do we need to cater for serverContainer.volumeMounts from values.yaml?
							VolumeMounts: append(
								[]corev1.VolumeMount{
									{
										Name:      "config",
										MountPath: "/config",
										ReadOnly:  true,
									},
									{
										Name:      "ide-config",
										MountPath: "/ide-config",
										ReadOnly:  true,
									},
									{
										Name:      "ws-manager-client-tls-certs",
										MountPath: "/ws-manager-client-tls-certs",
										ReadOnly:  true,
									},
								},
								volumeMounts...,
							),
						}, *common.KubeRBACProxyContainer(ctx)},
					},
				},
			},
		},
	}, nil
}
