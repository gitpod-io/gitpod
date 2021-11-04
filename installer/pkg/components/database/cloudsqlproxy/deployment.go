// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cloudsqlproxy

import (
	"fmt"

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
					},
					Spec: corev1.PodSpec{
						Affinity:                      common.Affinity(cluster.AffinityLabelMeta),
						ServiceAccountName:            Component,
						EnableServiceLinks:            pointer.Bool(false),
						DNSPolicy:                     "ClusterFirst",
						RestartPolicy:                 "Always",
						TerminationGracePeriodSeconds: pointer.Int64(30),
						Volumes: []corev1.Volume{
							{
								Name: "cloudsql",
								VolumeSource: corev1.VolumeSource{
									EmptyDir: &corev1.EmptyDirVolumeSource{},
								},
							},
							{
								Name: "service-account",
								VolumeSource: corev1.VolumeSource{
									Secret: &corev1.SecretVolumeSource{
										SecretName: ctx.Config.Database.CloudSQL.ServiceAccount.Name,
									},
								},
							},
						},
						Containers: []corev1.Container{{
							Name:            Component,
							Image:           "b.gcr.io/cloudsql-docker/gce-proxy:1.11",
							ImagePullPolicy: corev1.PullIfNotPresent,
							Args: []string{
								"/cloud_sql_proxy",
								"-dir=/cloudsql",
								fmt.Sprintf("-instances=%s=tcp:0.0.0.0:%d", ctx.Config.Database.CloudSQL.ConnectionName, Port),
								"-credential_file=/credentials/service-account.json",
							},
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									"cpu":    resource.MustParse("100m"),
									"memory": resource.MustParse("32Mi"),
								},
							},
							Ports: []corev1.ContainerPort{
								{
									ContainerPort: Port,
								},
							},
							SecurityContext: &corev1.SecurityContext{
								Privileged: pointer.Bool(false),
								RunAsUser:  pointer.Int64(1000),
							},
							Env: common.MergeEnv(
								common.DefaultEnv(&ctx.Config),
							),
							VolumeMounts: []corev1.VolumeMount{
								{
									Name:      "cloudsql",
									MountPath: "/cloudsql",
								},
								{
									Name:      "service-account",
									ReadOnly:  true,
									MountPath: "/credentials",
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
