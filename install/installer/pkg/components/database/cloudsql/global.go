// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cloudsql

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/pointer"
)

// Global CloudSQL is a cloud-sql-proxy which uses only one underlying database across multiple regions
func CloudSQLGlobalObjects(ctx *common.RenderContext) ([]runtime.Object, error) {
	if ctx.Config.Database.CloudSQLGlobal == nil {
		return nil, nil
	}

	return common.CompositeRenderFunc(
		cloudSQLGlobalDeployment,
		globalCloudSQLRoleBinding,
		common.DefaultServiceAccount(ComponentGlobal),
		common.GenerateService(ComponentGlobal, []common.ServicePort{
			{
				Name:          ComponentGlobal,
				ContainerPort: Port,
				ServicePort:   Port,
			},
		}),
	)(ctx)
}

func cloudSQLGlobalDeployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.CustomizeLabel(ctx, ComponentGlobal, common.TypeMetaDeployment)

	cfg := ctx.Config.Database.CloudSQLGlobal

	return []runtime.Object{
		&appsv1.Deployment{
			TypeMeta: common.TypeMetaDeployment,
			ObjectMeta: metav1.ObjectMeta{
				Name:        fmt.Sprintf("%s-cloud-sql-proxy", ComponentGlobal),
				Namespace:   ctx.Namespace,
				Labels:      labels,
				Annotations: common.CustomizeAnnotation(ctx, ComponentGlobal, common.TypeMetaDeployment),
			},
			Spec: appsv1.DeploymentSpec{
				Strategy: appsv1.DeploymentStrategy{
					Type: appsv1.RollingUpdateDeploymentStrategyType,
					RollingUpdate: &appsv1.RollingUpdateDeployment{
						MaxUnavailable: &intstr.IntOrString{IntVal: 0},
						MaxSurge:       &intstr.IntOrString{IntVal: 1},
					},
				},
				Selector: &metav1.LabelSelector{MatchLabels: common.DefaultLabels(ComponentGlobal)},
				Replicas: common.Replicas(ctx, ComponentGlobal),
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Name:        ComponentGlobal,
						Namespace:   ctx.Namespace,
						Labels:      labels,
						Annotations: common.CustomizeAnnotation(ctx, ComponentGlobal, common.TypeMetaDeployment),
					},
					Spec: corev1.PodSpec{
						Affinity: &corev1.Affinity{
							NodeAffinity: common.NodeAffinity(cluster.AffinityLabelMeta).NodeAffinity,
						},
						ServiceAccountName:            ComponentGlobal,
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
								SecretName: cfg.ServiceAccount.Name,
							}},
						}},
						Containers: []corev1.Container{{
							Name: "cloud-sql-proxy",
							SecurityContext: &corev1.SecurityContext{
								Privileged:               pointer.Bool(false),
								RunAsNonRoot:             pointer.Bool(false),
								AllowPrivilegeEscalation: pointer.Bool(false),
							},
							Image: ctx.ImageName(ImageRepo, ImageName, ImageVersion),
							Command: []string{
								"/cloud_sql_proxy",
								"-dir=/cloudsql",
								fmt.Sprintf("-instances=%s=tcp:0.0.0.0:%d", cfg.Instance, Port),
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
							Env: common.CustomizeEnvvar(ctx, ComponentGlobal, []corev1.EnvVar{}),
						}},
					},
				},
			},
		},
	}, nil
}

func globalCloudSQLRoleBinding(ctx *common.RenderContext) ([]runtime.Object, error) {
	return []runtime.Object{&rbacv1.RoleBinding{
		TypeMeta: common.TypeMetaRoleBinding,
		ObjectMeta: metav1.ObjectMeta{
			Name:      ComponentGlobal,
			Namespace: ctx.Namespace,
			Labels:    common.DefaultLabels(ComponentGlobal),
		},
		RoleRef: rbacv1.RoleRef{
			Kind:     "ClusterRole",
			Name:     fmt.Sprintf("%s-ns-psp:restricted-root-user", ctx.Namespace),
			APIGroup: "rbac.authorization.k8s.io",
		},
		Subjects: []rbacv1.Subject{{
			Kind: "ServiceAccount",
			Name: ComponentGlobal,
		}},
	}}, nil
}
