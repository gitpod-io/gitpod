// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package gitpod

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	batchv1 "k8s.io/api/batch/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func cronjob(ctx *common.RenderContext) ([]runtime.Object, error) {
	installationTelemetryComponent := fmt.Sprintf("%s-telemetry", Component)

	objectMeta := metav1.ObjectMeta{
		Name:      installationTelemetryComponent,
		Namespace: ctx.Namespace,
		Labels:    common.DefaultLabels(Component),
	}

	return []runtime.Object{
		// Telemetry calls home to provide anonymous information on the installation
		&batchv1.CronJob{
			TypeMeta:   common.TypeMetaBatchCronJob,
			ObjectMeta: objectMeta,
			Spec: batchv1.CronJobSpec{
				Schedule:                   TelemetryCronSchedule,
				SuccessfulJobsHistoryLimit: pointer.Int32(3),
				FailedJobsHistoryLimit:     pointer.Int32(1),
				ConcurrencyPolicy:          batchv1.ReplaceConcurrent,
				JobTemplate: batchv1.JobTemplateSpec{
					ObjectMeta: objectMeta,
					Spec: batchv1.JobSpec{
						Template: v1.PodTemplateSpec{
							ObjectMeta: objectMeta,
							Spec: v1.PodSpec{
								RestartPolicy:      v1.RestartPolicyOnFailure,
								ServiceAccountName: Component,
								EnableServiceLinks: pointer.Bool(false),
								// The init container is designed to emulate Helm hooks
								InitContainers: []v1.Container{*common.DatabaseWaiterContainer(ctx)},
								Containers: []v1.Container{
									{
										Name:            installationTelemetryComponent,
										Image:           common.ImageName(ctx.Config.Repository, "installation-telemetry", ctx.VersionManifest.Components.InstallationTelemetry.Version),
										ImagePullPolicy: v1.PullIfNotPresent,
										Args: []string{
											"send",
										},
										Env: []v1.EnvVar{
											{
												Name:  "GITPOD_INSTALLATION_VERSION",
												Value: ctx.VersionManifest.Version,
											},
											{
												Name:  "SERVER_URL",
												Value: fmt.Sprintf("http://%s.%s.svc.cluster.local:%d", common.ServerComponent, ctx.Namespace, common.ServerServicePort),
											},
										},
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
