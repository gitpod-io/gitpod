// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsmanager

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsdaemon "github.com/gitpod-io/gitpod/installer/pkg/components/ws-daemon"
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

	podSpec := corev1.PodSpec{
		PriorityClassName:         common.SystemNodeCritical,
		Affinity:                  cluster.WithNodeAffinityHostnameAntiAffinity(Component, cluster.AffinityLabelServices),
		TopologySpreadConstraints: cluster.WithHostnameTopologySpread(Component),
		EnableServiceLinks:        pointer.Bool(false),
		ServiceAccountName:        Component,
		Containers: []corev1.Container{
			{
				Name:            Component,
				Image:           ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.NodeLabeler.Version),
				ImagePullPolicy: corev1.PullIfNotPresent,
				Resources: common.ResourceRequirements(ctx, Component, Component, corev1.ResourceRequirements{
					Requests: corev1.ResourceList{
						"cpu":    resource.MustParse("100m"),
						"memory": resource.MustParse("32Mi"),
					},
				}),
				Args: []string{
					"run",
					fmt.Sprintf("--registry-facade-port=%v", common.RegistryFacadeServicePort),
					fmt.Sprintf("--ws-daemon-port=%v", wsdaemon.ServicePort),
					fmt.Sprintf("--namespace=%v", ctx.Namespace),
				},
				Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
					common.DefaultEnv(&ctx.Config),
				)),
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
			},
			*common.KubeRBACProxyContainerWithConfig(ctx),
		},
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
				Replicas: pointer.Int32(2),
				Strategy: common.DeploymentStrategy,
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Name:      Component,
						Namespace: ctx.Namespace,
						Labels:    labels,
					},
					Spec: podSpec,
				},
			},
		},
	}, nil
}
