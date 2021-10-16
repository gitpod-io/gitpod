// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager"
	wsmanagerbridge "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager-bridge"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(Component)

	// Convert to a JSON string
	fc, err := json.MarshalIndent(wsmanagerbridge.WSManagerList(), "", " ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal server.WorkspaceManagerList config: %w", err)
	}
	wsmanCfgManager := base64.StdEncoding.EncodeToString(fc)

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
					},
					Spec: corev1.PodSpec{
						Affinity:           &corev1.Affinity{},
						PriorityClassName:  "system-node-critical",
						ServiceAccountName: Component,
						EnableServiceLinks: pointer.Bool(false),
						// todo(sje): conditionally add github-app-cert-secret in
						// todo(sje): do we need to cater for serverContainer.volumeMounts from values.yaml?
						Volumes: []corev1.Volume{{
							Name: "config",
							VolumeSource: corev1.VolumeSource{
								ConfigMap: &corev1.ConfigMapVolumeSource{
									LocalObjectReference: corev1.LocalObjectReference{Name: Component},
								},
							},
						}, {
							Name: "ide-config",
							VolumeSource: corev1.VolumeSource{
								ConfigMap: &corev1.ConfigMapVolumeSource{
									LocalObjectReference: corev1.LocalObjectReference{Name: fmt.Sprintf("%s-ide-config", Component)},
								},
							},
						}, {
							Name: "ws-manager-client-tls-certs",
							VolumeSource: corev1.VolumeSource{
								Secret: &corev1.SecretVolumeSource{
									SecretName: wsmanager.TLSSecretNameClient,
								},
							},
						}},
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
							},{
								Name:          "testLogin",
								ContainerPort: 9333,
							}},
							// todo(sje): do we need to cater for serverContainer.env from values.yaml?
							Env: common.MergeEnv(
								common.DefaultEnv(&ctx.Config),
								common.TracingEnv(&ctx.Config),
								common.AnalyticsEnv(&ctx.Config),
								common.MessageBusEnv(&ctx.Config),
								[]corev1.EnvVar{{
									Name:  "CONFIG_PATH",
									Value: "/config/config.json",
								}, {
									Name:  "IDE_CONFIG_PATH",
									Value: "/ide-config/config.json",
								}, {
									Name:  "NODE_ENV",
									Value: "production", // todo(sje): will we need to change this?
								}, {
									Name:  "SHLVL",
									Value: "1",
								}, {
									Name:  "WSMAN_CFG_MANAGERS",
									Value: wsmanCfgManager,
								}},
							),
							// todo(sje): conditionally add github-app-cert-secret in
							// todo(sje): do we need to cater for serverContainer.volumeMounts from values.yaml?
							VolumeMounts: []corev1.VolumeMount{{
								Name:      "config",
								MountPath: "/config",
								ReadOnly:  true,
							}, {
								Name:      "ide-config",
								MountPath: "/ide-config",
								ReadOnly:  true,
							}, {
								Name:      "ws-manager-client-tls-certs",
								MountPath: "/ws-manager-client-tls-certs",
								ReadOnly:  true,
							}},
						}, *common.KubeRBACProxyContainer()},
					},
				},
			},
		},
	}, nil
}
