// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"encoding/base64"
	"fmt"
	"path"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/components/auth"
	contentservice "github.com/gitpod-io/gitpod/installer/pkg/components/content-service"
	"github.com/gitpod-io/gitpod/installer/pkg/components/spicedb"
	"github.com/gitpod-io/gitpod/installer/pkg/components/usage"
	wsmanagermk2 "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager-mk2"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsmanagerbridge "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager-bridge"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

	"github.com/gitpod-io/gitpod/common-go/kubernetes"
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

	//nolint:typecheck
	configHash, err := common.ObjectHash(hashObj, nil)
	if err != nil {
		return nil, err
	}

	// Convert to a JSON string
	fc, err := common.ToJSONString(wsmanagerbridge.WSManagerList(ctx))
	if err != nil {
		return nil, fmt.Errorf("failed to marshal server.WorkspaceManagerList config: %w", err)
	}
	wsmanCfgManager := base64.StdEncoding.EncodeToString(fc)

	env := common.MergeEnv(
		common.DefaultEnv(&ctx.Config),
		common.DatabaseEnv(&ctx.Config),
		common.WebappTracingEnv(ctx, Component),
		common.AnalyticsEnv(&ctx.Config),
		common.ConfigcatEnv(ctx),
		spicedb.Env(ctx),
		[]corev1.EnvVar{
			{
				Name:  "CONFIG_PATH",
				Value: "/config/config.json",
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

	volumes := make([]corev1.Volume, 0)
	volumeMounts := make([]corev1.VolumeMount, 0)

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
		if cfg.WebApp != nil && cfg.WebApp.Server != nil && cfg.WebApp.Server.LinkedInSecret != "" {
			linkedInSecret := cfg.WebApp.Server.LinkedInSecret

			volumes = append(volumes,
				corev1.Volume{
					Name: "linkedin-secret",
					VolumeSource: corev1.VolumeSource{
						Secret: &corev1.SecretVolumeSource{
							SecretName: linkedInSecret,
						},
					},
				})

			volumeMounts = append(volumeMounts, corev1.VolumeMount{
				Name:      "linkedin-secret",
				MountPath: linkedInSecretMountPath,
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

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		volume, mount, _, ok := getPersonalAccessTokenSigningKey(cfg)
		if !ok {
			return nil
		}

		volumes = append(volumes, volume)
		volumeMounts = append(volumeMounts, mount)
		return nil
	})

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

	adminCredentialsVolume, adminCredentialsMount, _ := getAdminCredentials()
	volumes = append(volumes, adminCredentialsVolume)
	volumeMounts = append(volumeMounts, adminCredentialsMount)

	authVolumes, authMounts, _ := auth.GetConfig(ctx)
	volumes = append(volumes, authVolumes...)
	volumeMounts = append(volumeMounts, authMounts...)

	imageName := ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.Server.Version)

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
								kubernetes.ImageNameAnnotation:  imageName,
							}
						}),
					},
					Spec: corev1.PodSpec{
						Affinity:                  cluster.WithNodeAffinityHostnameAntiAffinity(Component, cluster.AffinityLabelMeta),
						TopologySpreadConstraints: cluster.WithHostnameTopologySpread(Component),
						PriorityClassName:         common.SystemNodeCritical,
						ServiceAccountName:        Component,
						EnableServiceLinks:        pointer.Bool(false),
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
							Image:           imageName,
							ImagePullPolicy: corev1.PullIfNotPresent,
							Resources: common.ResourceRequirements(ctx, Component, Component, corev1.ResourceRequirements{
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
								Privileged:               pointer.Bool(false),
								AllowPrivilegeEscalation: pointer.Bool(false),
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
								Name:          IAMSessionPortName,
								ContainerPort: IAMSessionPort,
							}, {
								Name:          DebugPortName,
								ContainerPort: baseserver.BuiltinDebugPort,
							}, {
								Name:          DebugNodePortName,
								ContainerPort: common.DebugNodePort,
							}, {
								Name:          GRPCAPIName,
								ContainerPort: GRPCAPIPort,
							}, {
								Name:          PublicAPIName,
								ContainerPort: PublicAPIPort,
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
									common.CAVolumeMount(),
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
