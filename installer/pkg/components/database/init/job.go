// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

// This runs the init scripts in a non-inCluster DB instance

package init

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func job(ctx *common.RenderContext) ([]runtime.Object, error) {
	objectMeta := metav1.ObjectMeta{
		Name:      fmt.Sprintf("%s-session", Component),
		Namespace: ctx.Namespace,
		Labels:    common.DefaultLabels(Component, ctx),
	}

	return []runtime.Object{&batchv1.Job{
		TypeMeta:   common.TypeMetaBatchJob,
		ObjectMeta: objectMeta,
		Spec: batchv1.JobSpec{
			TTLSecondsAfterFinished: pointer.Int32(60),
			Template: corev1.PodTemplateSpec{
				ObjectMeta: objectMeta,
				Spec: corev1.PodSpec{
					Affinity:           common.Affinity(cluster.AffinityLabelMeta),
					RestartPolicy:      corev1.RestartPolicyNever,
					ServiceAccountName: Component,
					EnableServiceLinks: pointer.Bool(false),
					Volumes: []corev1.Volume{{
						Name: sqlInitScripts,
						VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{
							LocalObjectReference: corev1.LocalObjectReference{Name: sqlInitScripts},
						}},
					}},
					// The init container is designed to emulate Helm hooks
					InitContainers: []corev1.Container{*common.DatabaseWaiterContainer(ctx)},
					Containers: []corev1.Container{{
						Name:            fmt.Sprintf("%s-session", Component),
						Image:           fmt.Sprintf("%s:%s", dbSessionsImage, dbSessionsTag),
						ImagePullPolicy: corev1.PullIfNotPresent,
						Env: common.MergeEnv(
							common.DatabaseEnv(&ctx.Config),
						),
						Command: []string{
							"sh",
							"-c",
							"mysql -h $DB_HOST --port $DB_PORT -u $DB_USERNAME -p$DB_PASSWORD < /db-init-scripts/init.sql",
						},
						VolumeMounts: []corev1.VolumeMount{{
							Name:      sqlInitScripts,
							MountPath: "/db-init-scripts",
							ReadOnly:  true,
						}},
					}},
				},
			},
		},
	}}, nil
}
