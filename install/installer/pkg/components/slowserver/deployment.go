// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package slowserver

import (
	"encoding/base64"
	"fmt"
	"path"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	contentservice "github.com/gitpod-io/gitpod/installer/pkg/components/content-service"
	"github.com/gitpod-io/gitpod/installer/pkg/components/toxiproxy"
	"github.com/gitpod-io/gitpod/installer/pkg/components/usage"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager"
	wsmanagerbridge "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager-bridge"
	configv1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
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

	hashObj = append(hashObj, &corev1.Pod{
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{
					Env: []corev1.EnvVar{
						// If the database type changes, this pod may stay up if no other changes are made.
						{
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

	// Convert to a JSON string
	fc, err := common.ToJSONString(wsmanagerbridge.InClusterWSManagerList(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to marshal server.WorkspaceManagerList config: %w", err)
	}
	wsmanCfgManager := base64.StdEncoding.EncodeToString(fc)

	env := common.MergeEnv(
		common.DefaultEnv(&ctx.Config),
		common.DatabaseEnv(&ctx.Config),
		common.WebappTracingEnv(ctx, Component),
		common.AnalyticsEnv(&ctx.Config),
		common.MessageBusEnv(&ctx.Config),
		common.ConfigcatEnv(ctx),
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
	)

	for i := range env {
		if env[i].Name == "DB_HOST" {
			env[i].ValueFrom = nil
			env[i].Value = toxiproxy.Component
		}
	}

	if ctx.Config.HTTPProxy != nil {
		env = append(env, corev1.EnvVar{
			Name: "no_grpc_proxy",
			// @grpc/grpc-js does not support wildcards in NO_PROXY
			// @link https://github.com/grpc/grpc-node/issues/1293
			Value: strings.Join([]string{
				fmt.Sprintf("%s.%s.svc.cluster.local", contentservice.Component, ctx.Namespace),
				fmt.Sprintf("%s.%s.svc.cluster.local", common.ImageBuilderComponent, ctx.Namespace),
				fmt.Sprintf("%s.%s.svc.cluster.local", usage.Component, ctx.Namespace),
				"$(NO_PROXY)",
			}, ","),
		})
	}

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

	if len(wsmanagerbridge.InClusterWSManagerList(ctx)) > 0 {
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

	// mount the optional twilio secret
	truethy := true
	volumes = append(volumes, corev1.Volume{
		Name: "twilio-secret-volume",
		VolumeSource: corev1.VolumeSource{
			Secret: &corev1.SecretVolumeSource{
				SecretName: "twilio-secret",
				Optional:   &truethy,
			},
		},
	})

	volumeMounts = append(volumeMounts, corev1.VolumeMount{
		Name:      "twilio-secret-volume",
		MountPath: "/twilio-config",
		ReadOnly:  true,
	})

	if vol, mnt, envv, ok := common.CustomCACertVolume(ctx); ok {
		volumes = append(volumes, *vol)
		volumeMounts = append(volumeMounts, *mnt)
		env = append(env, envv...)
	}

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil && cfg.WebApp.Server.ChargebeeSecret != "" {
			chargebeeSecret := cfg.WebApp.Server.ChargebeeSecret

			volumes = append(volumes,
				corev1.Volume{
					Name: "chargebee-config",
					VolumeSource: corev1.VolumeSource{
						Secret: &corev1.SecretVolumeSource{
							SecretName: chargebeeSecret,
						},
					},
				})

			volumeMounts = append(volumeMounts, corev1.VolumeMount{
				Name:      "chargebee-config",
				MountPath: chargebeeMountPath,
				ReadOnly:  true,
			})
		}
		return nil
	})

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil && cfg.WebApp.Server.StripeSecret != "" {
			stripeSecret := cfg.WebApp.Server.StripeSecret

			volumes = append(volumes,
				corev1.Volume{
					Name: "stripe-secret",
					VolumeSource: corev1.VolumeSource{
						Secret: &corev1.SecretVolumeSource{
							SecretName: stripeSecret,
						},
					},
				})

			volumeMounts = append(volumeMounts, corev1.VolumeMount{
				Name:      "stripe-secret",
				MountPath: stripeSecretMountPath,
				ReadOnly:  true,
			})
		}
		return nil
	})

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil && cfg.WebApp.Server.StripeConfig != "" {
			stripeConfig := cfg.WebApp.Server.StripeConfig

			volumes = append(volumes,
				corev1.Volume{
					Name: "stripe-config",
					VolumeSource: corev1.VolumeSource{
						ConfigMap: &corev1.ConfigMapVolumeSource{
							LocalObjectReference: corev1.LocalObjectReference{Name: stripeConfig},
						},
					},
				})

			volumeMounts = append(volumeMounts, corev1.VolumeMount{
				Name:      "stripe-config",
				MountPath: stripeConfigMountPath,
				ReadOnly:  true,
			})
		}
		return nil
	})

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.Server != nil && cfg.WebApp.Server.GithubApp != nil {
			volumes = append(volumes,
				corev1.Volume{
					Name: githubAppCertSecret,
					VolumeSource: corev1.VolumeSource{
						Secret: &corev1.SecretVolumeSource{
							SecretName: cfg.WebApp.Server.GithubApp.CertSecretName,
						},
					},
				})

			volumeMounts = append(volumeMounts, corev1.VolumeMount{
				Name:      githubAppCertSecret,
				MountPath: path.Dir(cfg.WebApp.Server.GithubApp.CertPath),
				ReadOnly:  true,
			})
		}
		return nil
	})

	var podAntiAffinity *corev1.PodAntiAffinity
	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		if cfg.WebApp != nil && cfg.WebApp.UsePodAntiAffinity {
			podAntiAffinity = &corev1.PodAntiAffinity{
				PreferredDuringSchedulingIgnoredDuringExecution: []corev1.WeightedPodAffinityTerm{{
					Weight: 100,
					PodAffinityTerm: corev1.PodAffinityTerm{
						LabelSelector: &metav1.LabelSelector{
							MatchExpressions: []metav1.LabelSelectorRequirement{{
								Key:      "component",
								Operator: "In",
								Values:   []string{Component},
							}},
						},
						TopologyKey: cluster.AffinityLabelMeta,
					},
				}},
			}
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
				Replicas: common.Replicas(ctx, common.ServerComponent),
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
						Affinity: &corev1.Affinity{
							NodeAffinity:    common.NodeAffinity(cluster.AffinityLabelMeta).NodeAffinity,
							PodAntiAffinity: podAntiAffinity,
						},
						PriorityClassName:  common.SystemNodeCritical,
						ServiceAccountName: Component,
						EnableServiceLinks: pointer.Bool(false),
						// todo(sje): do we need to cater for serverContainer.volumeMounts from values.yaml?
						Volumes: append(
							[]corev1.Volume{
								{
									Name: "config",
									VolumeSource: corev1.VolumeSource{
										ConfigMap: &corev1.ConfigMapVolumeSource{
											LocalObjectReference: corev1.LocalObjectReference{Name: fmt.Sprintf("%s-config", common.ServerComponent)},
										},
									},
								},
								{
									Name: "ide-config",
									VolumeSource: corev1.VolumeSource{
										ConfigMap: &corev1.ConfigMapVolumeSource{
											LocalObjectReference: corev1.LocalObjectReference{Name: fmt.Sprintf("%s-ide-config", common.ServerComponent)},
										},
									},
								},
							},
							volumes...,
						),
						InitContainers: []corev1.Container{*common.DatabaseWaiterContainer(ctx), *common.MessageBusWaiterContainer(ctx)},
						Containers: []corev1.Container{{
							Name:            Component,
							Image:           ctx.ImageName(ctx.Config.Repository, common.ServerComponent, ctx.VersionManifest.Components.Server.Version),
							ImagePullPolicy: corev1.PullIfNotPresent,
							Resources: common.ResourceRequirements(ctx, common.ServerComponent, common.ServerComponent, corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									"cpu":    resource.MustParse("200m"),
									"memory": resource.MustParse("200Mi"),
								},
							}),
							LivenessProbe: &corev1.Probe{
								ProbeHandler: corev1.ProbeHandler{
									HTTPGet: &corev1.HTTPGetAction{
										Path: "/live",
										Port: intstr.IntOrString{
											Type:   intstr.Int,
											IntVal: ContainerPort,
										},
									},
								},
								InitialDelaySeconds: 120,
								PeriodSeconds:       10,
								FailureThreshold:    6,
							},
							SecurityContext: &corev1.SecurityContext{
								Privileged: pointer.Bool(false),
								RunAsUser:  pointer.Int64(31001),
							},
							Ports: []corev1.ContainerPort{{
								Name:          ContainerPortName,
								ContainerPort: ContainerPort,
							}, {
								Name:          baseserver.BuiltinMetricsPortName,
								ContainerPort: baseserver.BuiltinMetricsPort,
							}, {
								Name:          InstallationAdminName,
								ContainerPort: InstallationAdminPort,
							}, {
								Name:          DebugPortName,
								ContainerPort: baseserver.BuiltinDebugPort,
							}, {
								Name:          DebugNodePortName,
								ContainerPort: common.DebugNodePort,
							},
							},
							// todo(sje): do we need to cater for serverContainer.env from values.yaml?
							Env: common.CustomizeEnvvar(ctx, Component, env),
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
