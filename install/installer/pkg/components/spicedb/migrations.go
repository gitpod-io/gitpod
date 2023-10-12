// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package spicedb

import (
	"fmt"

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
		Name:      fmt.Sprintf("%s-migrations", Component),
		Namespace: ctx.Namespace,
		Labels:    common.CustomizeLabel(ctx, Component, common.TypeMetaBatchJob),
		Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaBatchJob, func() map[string]string {
			// Because we are using ArgoCD to deploy, we need to add these annotations so:
			// 1. it knows when to apply it (during the "PreSync" hook, before other manifests are applied)
			// 2. that it should remove it once it is done
			//   - this is necessary so it does not show up as "ouf of sync" once the "TTLSecondsAfterFinished" option kicks in
			//   - if we would not remove the job at all, we would have a name clash an future updates ("field is immutable")
			// docs: https://argo-cd.readthedocs.io/en/stable/user-guide/resource_hooks/#usage
			return map[string]string{
				"argocd.argoproj.io/hook":               "PreSync",
				"argocd.argoproj.io/hook-delete-policy": "HookSucceeded",
			}
		}),
	}

	return []runtime.Object{
		&batchv1.Job{
			TypeMeta:   common.TypeMetaBatchJob,
			ObjectMeta: objectMeta,
			Spec: batchv1.JobSpec{
				TTLSecondsAfterFinished: pointer.Int32(60),
				Template: corev1.PodTemplateSpec{
					ObjectMeta: objectMeta,
					Spec: corev1.PodSpec{
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
