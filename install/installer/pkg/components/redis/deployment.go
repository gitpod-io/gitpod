// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package redis

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.CustomizeLabel(ctx, Component, common.TypeMetaDeployment)

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
						Name:        Component,
						Namespace:   ctx.Namespace,
						Labels:      labels,
						Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaDeployment),
					},
					Spec: corev1.PodSpec{
						Affinity:                      common.NodeAffinity(cluster.AffinityLabelMeta),
						PriorityClassName:             common.SystemNodeCritical,
						ServiceAccountName:            Component,
						EnableServiceLinks:            pointer.Bool(false),
						DNSPolicy:                     "ClusterFirst",
						RestartPolicy:                 "Always",
						TerminationGracePeriodSeconds: pointer.Int64(30),
						SecurityContext: &corev1.PodSecurityContext{
							RunAsNonRoot: pointer.Bool(false),
						},
						Containers: []corev1.Container{
							{
								Name:            ContainerName,
								Image:           ctx.ImageName(common.ThirdPartyContainerRepo(ctx.Config.Repository, RegistryRepo), RegistryImage, ImageTag),
								ImagePullPolicy: corev1.PullIfNotPresent,
								Command: []string{
									"redis-server",
									`--save ""`,       // disable persistence
									"--appendonly no", // disable persistence
									"--maxmemory 100mb",
									"--maxmemory-policy allkeys-lru", // evict on LRU basis,
									fmt.Sprintf("--port %d", Port),
								},
								Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
									common.DefaultEnv(&ctx.Config),
								)),
								Ports: []corev1.ContainerPort{
									{
										ContainerPort: Port,
										Name:          PortName,
										Protocol:      *common.TCPProtocol,
									},
								},
								Resources: common.ResourceRequirements(ctx, Component, ContainerName, corev1.ResourceRequirements{
									Requests: corev1.ResourceList{
										"cpu":    resource.MustParse("0.1"),
										"memory": resource.MustParse("128M"),
									},
								}),
								SecurityContext: &corev1.SecurityContext{
									RunAsGroup:   pointer.Int64(65532),
									RunAsNonRoot: pointer.Bool(true),
									RunAsUser:    pointer.Int64(65532),
								},
								ReadinessProbe: &corev1.Probe{
									ProbeHandler: corev1.ProbeHandler{
										Exec: &v1.ExecAction{
											Command: []string{"redis-cli", "ping", "|", "grep", "pong"},
										},
									},
									InitialDelaySeconds: 5,
									PeriodSeconds:       30,
									FailureThreshold:    5,
									SuccessThreshold:    1,
									TimeoutSeconds:      3,
								},
							},
						},
					},
				},
			},
		},
	}, nil
}
