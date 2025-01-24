// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsmanagerbridge

import (
	"fmt"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsmanagermk2 "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager-mk2"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

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

	var hashObj []runtime.Object
	if objs, err := configmap(ctx); err != nil {
		return nil, err
	} else {
		hashObj = append(hashObj, objs...)
	}

	var volumes []corev1.Volume
	var volumeMounts []corev1.VolumeMount

	addWsManagerTls := common.WithLocalWsManager(ctx)
	if addWsManagerTls {
		volumes = append(volumes, corev1.Volume{
			Name: "ws-manager-client-tls-certs",
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: wsmanagermk2.TLSSecretNameClient,
				},
			},
		})
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      "ws-manager-client-tls-certs",
			MountPath: "/ws-manager-client-tls-certs",
			ReadOnly:  true,
		})
	}

	hashObj = append(hashObj, &corev1.Pod{
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{
					Env: []corev1.EnvVar{
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

	env := common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
		common.DefaultEnv(&ctx.Config),
		common.WorkspaceTracingEnv(ctx, Component),
		common.AnalyticsEnv(&ctx.Config),
		common.DatabaseEnv(&ctx.Config),
		common.ConfigcatEnv(ctx),
		[]corev1.EnvVar{{
			Name:  "WSMAN_BRIDGE_CONFIGPATH",
			Value: "/config/ws-manager-bridge.json",
		}},
	))

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Redis != nil {
			env = append(env, corev1.EnvVar{
				Name:  "REDIS_USERNAME",
				Value: cfg.WebApp.Redis.Username,
			})

			env = append(env, corev1.EnvVar{
				Name: "REDIS_PASSWORD",
				ValueFrom: &corev1.EnvVarSource{
					SecretKeyRef: &corev1.SecretKeySelector{
						LocalObjectReference: corev1.LocalObjectReference{
							Name: cfg.WebApp.Redis.SecretRef,
						},
						Key: "password",
					},
				},
			})
		}
		return nil
	})

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
						Affinity:                      cluster.WithNodeAffinityHostnameAntiAffinity(Component, cluster.AffinityLabelMeta),
						TopologySpreadConstraints:     cluster.WithHostnameTopologySpread(Component),
						ServiceAccountName:            Component,
						PriorityClassName:             common.SystemNodeCritical,
						EnableServiceLinks:            pointer.Bool(false),
						DNSPolicy:                     corev1.DNSClusterFirst,
						RestartPolicy:                 corev1.RestartPolicyAlways,
						TerminationGracePeriodSeconds: pointer.Int64(30),
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
								common.CAVolume(),
							},
							volumes...,
						),
						InitContainers: []corev1.Container{
							*common.DatabaseMigrationWaiterContainer(ctx),
							*common.RedisWaiterContainer(ctx),
						},
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
								Privileged:               pointer.Bool(false),
								AllowPrivilegeEscalation: pointer.Bool(false),
							},
							Env: env,
							Ports: []corev1.ContainerPort{
								{
									ContainerPort: baseserver.BuiltinMetricsPort,
									Name:          baseserver.BuiltinMetricsPortName,
								},
							},
							VolumeMounts: append(
								[]corev1.VolumeMount{
									{
										Name:      "config",
										MountPath: "/config",
										ReadOnly:  true,
									},
									common.CAVolumeMount(),
								},
								volumeMounts...,
							),
							LivenessProbe: &corev1.Probe{
								ProbeHandler: corev1.ProbeHandler{
									HTTPGet: &corev1.HTTPGetAction{
										Path: "/healthz",
										Port: intstr.FromInt(9090),
									},
								},
								InitialDelaySeconds: 15,
								PeriodSeconds:       20,
							},
						}, *common.KubeRBACProxyContainer(ctx)},
					},
				},
			},
		},
	}, nil
}
