// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanagermk2

import (
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/pointer"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsdaemon "github.com/gitpod-io/gitpod/installer/pkg/components/ws-daemon"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"
)

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(Component)

	configHash, err := common.ObjectHash(configmap(ctx))
	if err != nil {
		return nil, err
	}

	var volumes []corev1.Volume
	var volumeMounts []corev1.VolumeMount
	if ctx.Config.Kind == config.InstallationWorkspace {
		// Image builder TLS is only enabled in workspace clusters. This check
		// can be removed once image-builder-mk3 has been removed from application clusters
		// (https://github.com/gitpod-io/gitpod/issues/7845).
		volumes = append(volumes, corev1.Volume{
			Name: common.ImageBuilderVolumeTLSCerts,
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{SecretName: common.ImageBuilderTLSSecret},
			},
		})
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      common.ImageBuilderVolumeTLSCerts,
			MountPath: "/image-builder-mk3-tls-certs",
			ReadOnly:  true,
		})
	}
	if ctx.Config.SSHGatewayCAKey != nil {
		volumes = append(volumes, corev1.Volume{
			Name: "ca-key",
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: ctx.Config.SSHGatewayCAKey.Name,
					Optional:   pointer.Bool(true),
				},
			},
		})

		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      "ca-key",
			MountPath: "/mnt/ca-key/ca.pem",
			SubPath:   "ca.pem",
			ReadOnly:  true,
		})
	}

	podSpec := corev1.PodSpec{
		PriorityClassName:         common.SystemNodeCritical,
		Affinity:                  cluster.WithNodeAffinityHostnameAntiAffinity(Component, cluster.AffinityLabelServices),
		TopologySpreadConstraints: cluster.WithHostnameTopologySpread(Component),
		EnableServiceLinks:        pointer.Bool(false),
		ServiceAccountName:        Component,
		SecurityContext: &corev1.PodSecurityContext{
			RunAsUser: pointer.Int64(31002),
		},
		Containers: []corev1.Container{{
			Name: Component,
			Args: []string{
				"--config", "/config/config.json",
			},
			Image:           ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.WSManagerMk2.Version),
			ImagePullPolicy: corev1.PullIfNotPresent,
			Resources: common.ResourceRequirements(ctx, Component, Component, corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					"cpu":    resource.MustParse("100m"),
					"memory": resource.MustParse("32Mi"),
				},
			}),
			LivenessProbe: &corev1.Probe{
				ProbeHandler: corev1.ProbeHandler{
					HTTPGet: &corev1.HTTPGetAction{
						Path: "/healthz",
						Port: intstr.FromInt(HealthPort),
					},
				},
				InitialDelaySeconds: 15,
				PeriodSeconds:       20,
			},
			ReadinessProbe: &corev1.Probe{
				ProbeHandler: corev1.ProbeHandler{
					HTTPGet: &corev1.HTTPGetAction{
						Path: "/readyz",
						Port: intstr.FromInt(HealthPort),
					},
				},
				InitialDelaySeconds: 5,
				PeriodSeconds:       10,
			},
			Ports: []corev1.ContainerPort{
				{
					Name:          RPCPortName,
					ContainerPort: RPCPort,
				},
			},
			SecurityContext: &corev1.SecurityContext{
				Privileged: pointer.Bool(false),
			},
			Env: common.MergeEnv(
				common.DefaultEnv(&ctx.Config),
				common.WorkspaceTracingEnv(ctx, Component),
				[]corev1.EnvVar{{Name: "GRPC_GO_RETRY", Value: "on"}},
			),
			VolumeMounts: append([]corev1.VolumeMount{
				{
					Name:      VolumeConfig,
					MountPath: "/config",
					ReadOnly:  true,
				},
				{
					Name:      VolumeWorkspaceTemplate,
					MountPath: WorkspaceTemplatePath,
					ReadOnly:  true,
				},
				{
					Name:      wsdaemon.VolumeTLSCerts,
					MountPath: "/ws-daemon-tls-certs",
					ReadOnly:  true,
				},
				{
					Name:      VolumeTLSCerts,
					MountPath: "/certs",
					ReadOnly:  true,
				},
				common.CAVolumeMount(),
			}, volumeMounts...),
		},
			*common.KubeRBACProxyContainer(ctx),
		},
		Volumes: append([]corev1.Volume{
			{
				Name: VolumeConfig,
				VolumeSource: corev1.VolumeSource{
					ConfigMap: &corev1.ConfigMapVolumeSource{
						LocalObjectReference: corev1.LocalObjectReference{Name: Component},
					},
				},
			},
			{
				Name: VolumeWorkspaceTemplate,
				VolumeSource: corev1.VolumeSource{
					ConfigMap: &corev1.ConfigMapVolumeSource{
						LocalObjectReference: corev1.LocalObjectReference{Name: WorkspaceTemplateConfigMap},
					},
				},
			},
			{
				Name: wsdaemon.VolumeTLSCerts,
				VolumeSource: corev1.VolumeSource{
					Secret: &corev1.SecretVolumeSource{SecretName: wsdaemon.TLSSecretName},
				},
			},
			{
				Name: VolumeTLSCerts,
				VolumeSource: corev1.VolumeSource{
					Secret: &corev1.SecretVolumeSource{SecretName: TLSSecretNameSecret},
				},
			},
			common.CAVolume(),
		}, volumes...),
	}

	err = common.AddStorageMounts(ctx, &podSpec, Component)
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
			},
			Spec: appsv1.DeploymentSpec{
				Selector: &metav1.LabelSelector{MatchLabels: labels},
				Replicas: pointer.Int32(2),
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
					Spec: podSpec,
				},
			},
		},
	}, nil
}
