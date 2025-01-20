// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package public_api_server

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/components/auth"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/common-go/kubernetes"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/pointer"
)

const (
	configmapVolume = "config"
	configMountPath = "/config.json"
)

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	configHash, err := common.ObjectHash(configmap(ctx))
	if err != nil {
		return nil, err
	}

	databaseSecretVolume, databaseSecretMount, _ := common.DatabaseEnvSecret(ctx.Config)

	volumes := []corev1.Volume{
		{
			Name: configmapVolume,
			VolumeSource: corev1.VolumeSource{
				ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{
						Name: Component,
					},
				},
			},
		},
		databaseSecretVolume,
		common.CAVolume(),
	}
	volumeMounts := []corev1.VolumeMount{
		{
			Name:      configmapVolume,
			ReadOnly:  true,
			MountPath: configMountPath,
			SubPath:   configJSONFilename,
		},
		databaseSecretMount,
		common.CAVolumeMount(),
	}

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		volume, mount, _, ok := getStripeConfig(cfg)
		if !ok {
			return nil
		}

		volumes = append(volumes, volume)
		volumeMounts = append(volumeMounts, mount)
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

	authVolumes, authMounts, _ := auth.GetConfig(ctx)
	volumes = append(volumes, authVolumes...)
	volumeMounts = append(volumeMounts, authMounts...)

	labels := common.CustomizeLabel(ctx, Component, common.TypeMetaDeployment)

	imageName := ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.PublicAPIServer.Version)
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
						Affinity:                      cluster.WithNodeAffinityHostnameAntiAffinity(Component, cluster.AffinityLabelMeta),
						TopologySpreadConstraints:     cluster.WithHostnameTopologySpread(Component),
						ServiceAccountName:            Component,
						EnableServiceLinks:            pointer.Bool(false),
						DNSPolicy:                     corev1.DNSClusterFirst,
						RestartPolicy:                 corev1.RestartPolicyAlways,
						TerminationGracePeriodSeconds: pointer.Int64(30),
						InitContainers: []corev1.Container{
							*common.DatabaseMigrationWaiterContainer(ctx),
							*common.RedisWaiterContainer(ctx),
						},
						Containers: []corev1.Container{
							{
								Name:  Component,
								Image: imageName,
								Args: []string{
									"run",
									fmt.Sprintf("--config=%s", configMountPath),
									"--json-log=true",
								},
								ImagePullPolicy: corev1.PullIfNotPresent,
								Resources: common.ResourceRequirements(ctx, Component, Component, corev1.ResourceRequirements{
									Requests: corev1.ResourceList{
										"cpu":    resource.MustParse("100m"),
										"memory": resource.MustParse("32Mi"),
									},
								}),
								Ports: []corev1.ContainerPort{
									{
										ContainerPort: GRPCContainerPort,
										Name:          GRPCPortName,
									},
								},
								SecurityContext: &corev1.SecurityContext{
									Privileged:               pointer.Bool(false),
									AllowPrivilegeEscalation: pointer.Bool(false),
								},
								Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
									common.DefaultEnv(&ctx.Config),
									common.ConfigcatEnv(ctx),
									common.DatabaseEnv(&ctx.Config),
								)),
								LivenessProbe: &corev1.Probe{
									ProbeHandler: corev1.ProbeHandler{
										HTTPGet: &corev1.HTTPGetAction{
											Path:   "/live",
											Port:   intstr.IntOrString{IntVal: baseserver.BuiltinHealthPort},
											Scheme: corev1.URISchemeHTTP,
										},
									},
									FailureThreshold: 3,
									SuccessThreshold: 1,
									TimeoutSeconds:   1,
								},
								ReadinessProbe: &corev1.Probe{
									ProbeHandler: corev1.ProbeHandler{
										HTTPGet: &corev1.HTTPGetAction{
											Path:   "/ready",
											Port:   intstr.IntOrString{IntVal: baseserver.BuiltinHealthPort},
											Scheme: corev1.URISchemeHTTP,
										},
									},
									FailureThreshold: 3,
									SuccessThreshold: 1,
									TimeoutSeconds:   1,
								},
								VolumeMounts: volumeMounts,
							},
							*common.KubeRBACProxyContainer(ctx),
						},
						Volumes: volumes,
					},
				},
			},
		},
	}, nil
}
