// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cloudsql

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/pointer"
)

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(Component, ctx)

	return []runtime.Object{
		&appsv1.Deployment{
			TypeMeta: common.TypeMetaDeployment,
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("%s-cloud-sql-proxy", Component),
				Namespace: ctx.Namespace,
				Labels:    labels,
			},
			Spec: appsv1.DeploymentSpec{
				Strategy: appsv1.DeploymentStrategy{
					Type: appsv1.RollingUpdateDeploymentStrategyType,
					RollingUpdate: &appsv1.RollingUpdateDeployment{
						MaxUnavailable: &intstr.IntOrString{IntVal: 0},
						MaxSurge:       &intstr.IntOrString{IntVal: 1},
					},
				},
				Selector: &metav1.LabelSelector{MatchLabels: labels},
				// todo(sje): receive config value
				Replicas: pointer.Int32(1),
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Name:      Component,
						Namespace: ctx.Namespace,
						Labels:    labels,
					},
					Spec: corev1.PodSpec{
						Affinity:                      &corev1.Affinity{},
						ServiceAccountName:            Component,
						EnableServiceLinks:            pointer.Bool(false),
						DNSPolicy:                     "ClusterFirst",
						RestartPolicy:                 "Always",
						TerminationGracePeriodSeconds: pointer.Int64(30),
						Volumes: []corev1.Volume{{
							Name:         "cloudsql",
							VolumeSource: corev1.VolumeSource{EmptyDir: &corev1.EmptyDirVolumeSource{}},
						}, {
							Name: "gcloud-sql-token",
							VolumeSource: corev1.VolumeSource{Secret: &corev1.SecretVolumeSource{
								SecretName: ctx.Config.Database.CloudSQL.ServiceAccount.Name,
							}},
						}},
						Containers: []corev1.Container{{
							Name: "cloud-sql-proxy",
							SecurityContext: &corev1.SecurityContext{
								Privileged:   pointer.Bool(false),
								RunAsNonRoot: pointer.Bool(false),
							},
							Image: common.ImageName(ImageRepo, ImageName, ImageVersion),
							Command: []string{
								"/cloud_sql_proxy",
								"-dir=/cloudsql",
								fmt.Sprintf("-instances=%s=tcp:0.0.0.0:%d", ctx.Config.Database.CloudSQL.Instance, Port),
								"-credential_file=/credentials/credentials.json",
							},
							Ports: []corev1.ContainerPort{{
								ContainerPort: Port,
							}},
							VolumeMounts: []corev1.VolumeMount{{
								MountPath: "/cloudsql",
								Name:      "cloudsql",
							}, {
								MountPath: "/credentials",
								Name:      "gcloud-sql-token",
							}},
						}},
					},
				},
			},
		},
	}, nil
}
