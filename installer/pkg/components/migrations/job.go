// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package migrations

import (
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
		Name:      Component,
		Namespace: ctx.Namespace,
		Labels:    common.DefaultLabels(Component),
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
					// The init container is designed to emulate Helm hooks
					InitContainers: []corev1.Container{*common.DatabaseWaiterContainer(ctx)},
					Containers: []corev1.Container{{
						Name:            Component,
						Image:           common.ImageName(ctx.Config.Repository, "db-migrations", ctx.VersionManifest.Components.DBMigrations.Version),
						ImagePullPolicy: corev1.PullIfNotPresent,
						Env: common.MergeEnv(
							common.DatabaseEnv(&ctx.Config),
						),
						Command: []string{
							"sh",
							"-c",
							"cd /app/node_modules/@gitpod/gitpod-db && yarn run wait-for-db && yarn run typeorm migrations:run",
						},
					}},
				},
			},
		},
	}}, nil
}
