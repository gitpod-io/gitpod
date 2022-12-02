// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanagerbridge

import (
	"fmt"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
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
	labels := common.CustomizeLabel(ctx, Component, common.TypeMetaDeployment)

	var hashObj []runtime.Object
	if objs, err := configmap(ctx); err != nil {
		return nil, err
	} else {
		hashObj = append(hashObj, objs...)
	}

	hashObj = append(hashObj, &corev1.Pod{
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{
					Env: []corev1.EnvVar{
						{
							Name:  "MESSAGEBUS_PASSWORD",
							Value: ctx.Values.MessageBusPassword,
						},
						{
							// If the database type changes, this pod may stay up if no other changes are made.
							Name: "DATABASE_TYPE",
							Value: func() string {
								if pointer.BoolDeref(ctx.Config.Database.InCluster, false) {
									return "in-cluster"
								}
								if ctx.Config.Database.CloudSQL != nil {
									return "cloudsql"
								}
								return "external"
							}(),
						},
					},
				},
			},
		},
	})
	configHash, err := common.ObjectHash(hashObj, nil)
	if err != nil {
		return nil, err
	}

	volumes := []corev1.Volume{
		{
			Name: "config",
			VolumeSource: corev1.VolumeSource{
				ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{Name: fmt.Sprintf("%s-config", Component)},
				},
			},
		},
	}
	volumeMounts := []corev1.VolumeMount{
		{
			Name:      "config",
			MountPath: "/config",
			ReadOnly:  true,
		},
	}
	if len(InClusterWSManagerList(ctx)) > 0 {
		volumes = append(volumes, corev1.Volume{
			Name: "ws-manager-client-tls-certs",
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: wsmanager.TLSSecretNameClient,
				},
			},
		})
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      "ws-manager-client-tls-certs",
			MountPath: "/ws-manager-client-tls-certs",
			ReadOnly:  true,
		})
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
						Affinity:                      common.NodeAffinity(cluster.AffinityLabelMeta),
						ServiceAccountName:            Component,
						PriorityClassName:             common.SystemNodeCritical,
						EnableServiceLinks:            pointer.Bool(false),
						DNSPolicy:                     "ClusterFirst",
						RestartPolicy:                 "Always",
						TerminationGracePeriodSeconds: pointer.Int64(30),
						Volumes:                       volumes,
						InitContainers:                []corev1.Container{*common.DatabaseWaiterContainer(ctx), *common.MessageBusWaiterContainer(ctx)},
						Containers: []corev1.Container{{
							Name:            Component,
							Image:           ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.WSManagerBridge.Version),
							ImagePullPolicy: corev1.PullIfNotPresent,
							Resources: common.ResourceRequirements(ctx, Component, Component, corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									"cpu":    resource.MustParse("100m"),
									"memory": resource.MustParse("64Mi"),
								},
							}),
							SecurityContext: &corev1.SecurityContext{
								Privileged: pointer.Bool(false),
								RunAsUser:  pointer.Int64(31001),
							},
							Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
								common.DefaultEnv(&ctx.Config),
								common.WorkspaceTracingEnv(ctx, Component),
								common.AnalyticsEnv(&ctx.Config),
								common.MessageBusEnv(&ctx.Config),
								common.DatabaseEnv(&ctx.Config),
								common.ConfigcatEnv(ctx),
								[]corev1.EnvVar{{
									Name:  "WSMAN_BRIDGE_CONFIGPATH",
									Value: "/config/ws-manager-bridge.json",
								}},
							)),
							Ports: []corev1.ContainerPort{
								{
									ContainerPort: baseserver.BuiltinMetricsPort,
									Name:          baseserver.BuiltinMetricsPortName,
								},
							},
							VolumeMounts: volumeMounts,
						}, *common.KubeRBACProxyContainer(ctx)},
					},
				},
			},
		},
	}, nil
}
