// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsdaemon "github.com/gitpod-io/gitpod/installer/pkg/components/ws-daemon"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(Component)

	configHash, err := common.ObjectHash(configmap(ctx))
	if err != nil {
		return nil, err
	}

	podSpec := corev1.PodSpec{
		PriorityClassName:  common.SystemNodeCritical,
		Affinity:           &corev1.Affinity{},
		EnableServiceLinks: pointer.Bool(false),
		ServiceAccountName: Component,
		SecurityContext: &corev1.PodSecurityContext{
			RunAsUser: pointer.Int64(31002),
		},
		Containers: []corev1.Container{{
			Name:            Component,
			Args:            []string{"run", "-v", "--config", "/config/config.json"},
			Image:           common.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.WSManager.Version),
			ImagePullPolicy: corev1.PullIfNotPresent,
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					"cpu":    resource.MustParse("100m"),
					"memory": resource.MustParse("32Mi"),
				},
			},
			Ports: []corev1.ContainerPort{{
				Name:          RPCPortName,
				ContainerPort: RPCPort,
			}},
			SecurityContext: &corev1.SecurityContext{
				Privileged: pointer.Bool(false),
			},
			Env: common.MergeEnv(
				common.DefaultEnv(&ctx.Config),
				common.TracingEnv(&ctx.Config),
				[]corev1.EnvVar{{Name: "GRPC_GO_RETRY", Value: "on"}},
			),
			VolumeMounts: []corev1.VolumeMount{{
				Name:      VolumeConfig,
				MountPath: "/config",
				ReadOnly:  true,
			}, {
				Name:      VolumeWorkspaceTemplate,
				MountPath: WorkspaceTemplatePath,
				ReadOnly:  true,
			}, {
				Name:      wsdaemon.VolumeTLSCerts,
				MountPath: "/ws-daemon-tls-certs",
				ReadOnly:  true,
			}, {
				Name:      VolumeTLSCerts,
				MountPath: "/certs",
				ReadOnly:  true,
			}},
		}},
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
		},
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
				Replicas: common.Replicas(ctx),
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
