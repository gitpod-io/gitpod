// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package content_service

import (
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"

	v1 "k8s.io/api/apps/v1"
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
		Affinity:                      common.Affinity(cluster.AffinityLabelMeta),
		ServiceAccountName:            Component,
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
		}},
		Containers: []corev1.Container{{
			Name:            Component,
			Image:           common.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.ContentService.Version),
			ImagePullPolicy: corev1.PullIfNotPresent,
			Args: []string{
				"run",
				"--config",
				"/config/config.json",
			},
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					"cpu":    resource.MustParse("100m"),
					"memory": resource.MustParse("32Mi"),
				},
			},
			Ports: []corev1.ContainerPort{{
				Name:          RPCServiceName,
				ContainerPort: RPCPort,
			}, {
				ContainerPort: PrometheusPort,
				Name:          PrometheusName,
			}},
			SecurityContext: &corev1.SecurityContext{
				Privileged: pointer.Bool(false),
				RunAsUser:  pointer.Int64(1000),
			},
			Env: common.MergeEnv(
				common.DefaultEnv(&ctx.Config),
				common.TracingEnv(&ctx.Config),
				[]corev1.EnvVar{{
					Name:  "GRPC_GO_RETRY",
					Value: "on",
				}},
			),
			VolumeMounts: []corev1.VolumeMount{{
				Name:      "config",
				MountPath: "/config",
				ReadOnly:  true,
			}},
		}},
	}

	err = common.AddStorageMounts(ctx, &podSpec, Component)
	if err != nil {
		return nil, err
	}

	return []runtime.Object{
		&v1.Deployment{
			TypeMeta: common.TypeMetaDeployment,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    labels,
			},
			Spec: v1.DeploymentSpec{
				Selector: &metav1.LabelSelector{MatchLabels: labels},
				Replicas: pointer.Int32(1),
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
