// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package ide_service

import (
	"fmt"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	dockerregistry "github.com/gitpod-io/gitpod/installer/pkg/components/docker-registry"

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

	volumeName := "pull-secret"
	var secretName string
	if pointer.BoolDeref(ctx.Config.ContainerRegistry.InCluster, false) {
		secretName = dockerregistry.BuiltInRegistryAuth
	} else if ctx.Config.ContainerRegistry.External != nil {
		if ctx.Config.ContainerRegistry.External.Certificate != nil {
			secretName = ctx.Config.ContainerRegistry.External.Certificate.Name
		}
	} else {
		return nil, fmt.Errorf("%s: invalid container registry config", Component)
	}

	configHash, err := common.ObjectHash(configmap(ctx))
	if err != nil {
		return nil, err
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
						Affinity:                      cluster.WithNodeAffinityHostnameAntiAffinity(Component, cluster.AffinityLabelMeta),
						TopologySpreadConstraints:     cluster.WithHostnameTopologySpread(Component),
						ServiceAccountName:            Component,
						EnableServiceLinks:            pointer.Bool(false),
						DNSPolicy:                     corev1.DNSClusterFirst,
						RestartPolicy:                 corev1.RestartPolicyAlways,
						TerminationGracePeriodSeconds: pointer.Int64(30),
						Containers: []corev1.Container{{
							Args:            []string{"run", "--config", "/config/config.json"},
							Name:            Component,
							Image:           ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.IDEService.Version),
							ImagePullPolicy: corev1.PullIfNotPresent,
							Resources: common.ResourceRequirements(ctx, Component, Component, corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									"cpu":    resource.MustParse("100m"),
									"memory": resource.MustParse("128Mi"),
								},
							}),
							Ports: []corev1.ContainerPort{{
								ContainerPort: GRPCServicePort,
								Name:          GRPCPortName,
							}},
							SecurityContext: &corev1.SecurityContext{
								Privileged:               pointer.Bool(false),
								AllowPrivilegeEscalation: pointer.Bool(false),
							},
							Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
								common.DefaultEnv(&ctx.Config),
								common.ConfigcatEnv(ctx),
							)),
							VolumeMounts: []corev1.VolumeMount{
								{
									Name:      VolumeConfig,
									MountPath: "/config",
									ReadOnly:  true,
								},
								{
									Name:      "ide-config",
									MountPath: "/ide-config",
									ReadOnly:  true,
								},
								{
									Name:      volumeName,
									MountPath: "/mnt/pull-secret",
								},
							},
							ReadinessProbe: &corev1.Probe{
								ProbeHandler: corev1.ProbeHandler{
									HTTPGet: &corev1.HTTPGetAction{
										Path: "/ready",
										Port: intstr.IntOrString{IntVal: baseserver.BuiltinHealthPort},
									},
								},
								FailureThreshold: 3,
								SuccessThreshold: 1,
								TimeoutSeconds:   1,
							},
						},
							*common.KubeRBACProxyContainerWithConfig(ctx),
						},
						Volumes: []corev1.Volume{
							{
								Name: VolumeConfig,
								VolumeSource: corev1.VolumeSource{
									ConfigMap: &corev1.ConfigMapVolumeSource{
										LocalObjectReference: corev1.LocalObjectReference{Name: Component},
									},
								},
							},
							{
								Name: "ide-config",
								VolumeSource: corev1.VolumeSource{
									ConfigMap: &corev1.ConfigMapVolumeSource{
										LocalObjectReference: corev1.LocalObjectReference{Name: "ide-config"},
									},
								},
							},
							{
								Name: volumeName,
								VolumeSource: corev1.VolumeSource{
									Secret: &corev1.SecretVolumeSource{
										SecretName: secretName,
										Items:      []corev1.KeyToPath{{Key: ".dockerconfigjson", Path: "pull-secret.json"}},
									},
								},
							},
						},
					},
				},
			},
		},
	}, nil
}
