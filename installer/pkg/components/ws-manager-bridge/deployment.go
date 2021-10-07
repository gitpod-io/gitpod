// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanagerbridge

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
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

	// todo(sje): get value from workspace pull secret
	var pullSecret corev1.VolumeMount
	pullSecretVolume := corev1.Volume{
		Name: "pull-secret",
		VolumeSource: corev1.VolumeSource{Secret: &corev1.SecretVolumeSource{
			SecretName: "",
		}},
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
						Affinity:                      &corev1.Affinity{},
						ServiceAccountName:            Component,
						PriorityClassName:             "system-node-critical",
						EnableServiceLinks:            pointer.Bool(false),
						DNSPolicy:                     "ClusterFirst",
						RestartPolicy:                 "Always",
						TerminationGracePeriodSeconds: pointer.Int64(30),
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
						}, pullSecretVolume},
						InitContainers: []corev1.Container{*common.DatabaseWaiterContainer(), *common.MessageBusWaiterContainer()},
						Containers: []corev1.Container{{
							Name:            Component,
							Args:            []string{"run", "-v", "/mnt/config/config.json"},
							Image:           common.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.Blobserve.Version),
							ImagePullPolicy: corev1.PullIfNotPresent,
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									"cpu":    resource.MustParse("100m"),
									"memory": resource.MustParse("64Mi"),
								},
							},
							SecurityContext: &corev1.SecurityContext{
								Privileged: pointer.Bool(false),
								RunAsUser:  pointer.Int64(31001),
							},
							Env: common.MergeEnv(
								common.DefaultEnv(&ctx.Config),
								common.TracingEnv(&ctx.Config),
								common.AnalyticsEnv(&ctx.Config),
								common.MessageBusEnv(&ctx.Config),
								common.DatabaseEnv(&ctx.Config),
								[]corev1.EnvVar{{
									Name:  "WSMAN_BRIDGE_CONFIGPATH",
									Value: "/config/ws-manager-bridge.json",
								}},
							),
							VolumeMounts: []corev1.VolumeMount{{
								Name:      "config",
								MountPath: "/mnt/config",
								ReadOnly:  true,
							}, {
								Name:      "ws-manager-client-tls-certs",
								MountPath: "/ws-manager-client-tls-certs",
								ReadOnly:  true,
							}, pullSecret},
						}, *common.KubeRBACProxyContainer()},
					},
				},
			},
		},
	}, nil
}
