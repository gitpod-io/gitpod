// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package spicedb

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

func migrations(ctx *common.RenderContext) ([]runtime.Object, error) {

	cfg := getExperimentalSpiceDBConfig(ctx)
	if cfg == nil {
		return nil, nil
	}

	if cfg.DisableMigrations {
		return nil, nil
	}

	objectMeta := metav1.ObjectMeta{
		Name:        Component,
		Namespace:   ctx.Namespace,
		Labels:      common.CustomizeLabel(ctx, Component, common.TypeMetaBatchJob),
		Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaBatchJob),
	}

	return []runtime.Object{
		&batchv1.Job{
			TypeMeta:   common.TypeMetaBatchJob,
			ObjectMeta: objectMeta,
			Spec: batchv1.JobSpec{
				TTLSecondsAfterFinished: pointer.Int32(120),
				Template: corev1.PodTemplateSpec{
					ObjectMeta: objectMeta,
					Spec: corev1.PodSpec{
						Affinity:           common.NodeAffinity(cluster.AffinityLabelMeta),
						RestartPolicy:      corev1.RestartPolicyNever,
						ServiceAccountName: Component,
						EnableServiceLinks: pointer.Bool(false),
						InitContainers: []corev1.Container{
							dbWaiter(ctx),
						},
						Containers: []corev1.Container{{
							Name:            fmt.Sprintf("%s-migrations", Component),
							Image:           ctx.ImageName(common.ThirdPartyContainerRepo(ctx.Config.Repository, RegistryRepo), RegistryImage, ImageTag),
							ImagePullPolicy: corev1.PullIfNotPresent,
							Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
								common.DefaultEnv(&ctx.Config),
								spicedbEnvVars(ctx),
							)),
							SecurityContext: &corev1.SecurityContext{
								AllowPrivilegeEscalation: pointer.Bool(false),
							},
							Args: []string{
								"migrate",
								"head",
								"--log-format=json",
								"--log-level=debug",
								"--datastore-engine=mysql",
							},
						}},
					},
				},
			},
		},
	}, nil
}
