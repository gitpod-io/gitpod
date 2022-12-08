// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package usage

import (
	"fmt"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/pointer"
)

const (
	usageConfigmapVolume = "config"
	usageConfigMountPath = "/config.json"
)

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.CustomizeLabel(ctx, Component, common.TypeMetaDeployment)

	args := []string{
		"run",
		fmt.Sprintf("--config=%s", usageConfigMountPath),
	}

	volumes := []corev1.Volume{
		{
			Name: usageConfigmapVolume,
			VolumeSource: corev1.VolumeSource{
				ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{
						Name: Component,
					},
				},
			},
		},
	}
	volumeMounts := []corev1.VolumeMount{
		{
			Name:      usageConfigmapVolume,
			ReadOnly:  true,
			MountPath: usageConfigMountPath,
			SubPath:   configJSONFilename,
		},
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

	configHash, err := common.ObjectHash(configmap(ctx))
	if err != nil {
		return nil, err
	}

	return []runtime.Object{
		&appsv1.Deployment{
			TypeMeta: common.TypeMetaDeployment,
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
			Spec: appsv1.DeploymentSpec{
				Selector: &metav1.LabelSelector{MatchLabels: common.DefaultLabels(Component)},
				Replicas: common.Replicas(ctx, Component),
				Strategy: common.DeploymentStrategy,
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Name:        Component,
						Namespace:   ctx.Namespace,
						Labels:      labels,
						Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaDeployment),
					},
					Spec: corev1.PodSpec{
						Affinity:                      common.NodeAffinity(cluster.AffinityLabelMeta),
						ServiceAccountName:            Component,
						EnableServiceLinks:            pointer.Bool(false),
						DNSPolicy:                     "ClusterFirst",
						RestartPolicy:                 "Always",
						TerminationGracePeriodSeconds: pointer.Int64(30),
						InitContainers:                []corev1.Container{*common.DatabaseWaiterContainer(ctx)},
						Volumes:                       volumes,
						Containers: []corev1.Container{{
							Name:            Component,
							Image:           ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.Usage.Version),
							Args:            args,
							ImagePullPolicy: corev1.PullIfNotPresent,
							Resources: common.ResourceRequirements(ctx, Component, Component, corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									"cpu":    resource.MustParse("100m"),
									"memory": resource.MustParse("64Mi"),
								},
							}),
							Ports: []corev1.ContainerPort{},
							SecurityContext: &corev1.SecurityContext{
								Privileged:               pointer.Bool(false),
								AllowPrivilegeEscalation: pointer.Bool(false),
							},
							Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
								common.DefaultEnv(&ctx.Config),
								common.DatabaseEnv(&ctx.Config),
								common.ConfigcatEnv(ctx),
							)),
							VolumeMounts: volumeMounts,
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
						},
							*common.KubeRBACProxyContainerWithConfig(ctx),
						},
					},
				},
			},
		},
	}, nil
}
