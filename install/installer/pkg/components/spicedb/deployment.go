// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package spicedb

import (
	"errors"
	"fmt"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/database/cloudsql"

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

	cfg := getExperimentalSpiceDBConfig(ctx)
	if cfg == nil || !cfg.Enabled {
		return nil, nil
	}

	if cfg.SecretRef == "" {
		return nil, errors.New("missing configuration for spicedb.secretRef")
	}

	bootstrapVolume, bootstrapVolumeMount, bootstrapFiles, err := getBootstrapConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get bootstrap config: %w", err)
	}

	replicas := common.Replicas(ctx, Component)

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
				Replicas: replicas,
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
						InitContainers: []corev1.Container{
							dbWaiter(ctx),
						},
						Containers: []corev1.Container{
							{
								Name:            ContainerName,
								Image:           ctx.ImageName(common.ThirdPartyContainerRepo(ctx.Config.Repository, RegistryRepo), RegistryImage, ImageTag),
								ImagePullPolicy: corev1.PullIfNotPresent,
								Args: (func() []string {
									args := []string{
										"serve",
										"--log-format=json",
										"--log-level=debug",
										"--datastore-engine=mysql",
										"--datastore-conn-max-open=100",
										"--telemetry-endpoint=", // disable telemetry to https://telemetry.authzed.com
										fmt.Sprintf("--datastore-bootstrap-files=%s", strings.Join(bootstrapFiles, ",")),
										"--dispatch-cluster-enabled=true",
										"--datastore-bootstrap-overwrite=true",
										fmt.Sprintf("--metrics-addr=:%d", baseserver.BuiltinMetricsPort),
									}

									// Dispatching only makes sense, when we have more than one replica
									if *replicas > 1 {
										args = append(args, fmt.Sprintf("--dispatch-upstream-addr=kubernetes:///spicedb:%d", ContainerDispatchPort))
									}

									return args
								})(),
								Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
									common.DefaultEnv(&ctx.Config),
									spicedbEnvVars(ctx),
								)),
								Ports: []corev1.ContainerPort{
									{
										ContainerPort: ContainerGRPCPort,
										Name:          ContainerGRPCName,
										Protocol:      *common.TCPProtocol,
									},
									{
										ContainerPort: ContainerHTTPPort,
										Name:          ContainerHTTPName,
										Protocol:      *common.TCPProtocol,
									},
									{
										ContainerPort: ContainerDashboardPort,
										Name:          ContainerDashboardName,
										Protocol:      *common.TCPProtocol,
									},
									{
										ContainerPort: ContainerDispatchPort,
										Name:          ContainerDispatchName,
										Protocol:      *common.TCPProtocol,
									},
									{
										ContainerPort: ContainerPrometheusPort,
										Name:          ContainterPrometheusName,
										Protocol:      *common.TCPProtocol,
									},
								},
								Resources: common.ResourceRequirements(ctx, Component, ContainerName, corev1.ResourceRequirements{
									Requests: corev1.ResourceList{
										"cpu":    resource.MustParse("1"),
										"memory": resource.MustParse("500M"),
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
											Command: []string{"grpc_health_probe", "-v", "-addr=localhost:50051"},
										},
									},
									FailureThreshold: 5,
									PeriodSeconds:    10,
									SuccessThreshold: 1,
									TimeoutSeconds:   5,
								},
								VolumeMounts: []v1.VolumeMount{
									bootstrapVolumeMount,
								},
							},
							*common.KubeRBACProxyContainer(ctx),
						},
						Volumes: []v1.Volume{
							bootstrapVolume,
						},
					},
				},
			},
		},
	}, nil
}

func dbEnvVars(ctx *common.RenderContext) []corev1.EnvVar {
	containerEnvVars := common.DatabaseEnv(&ctx.Config)

	if ctx.Config.Database.CloudSQLGlobal != nil {
		withoutDBHost := filterOutEnvVars("DB_HOST", containerEnvVars)
		withoutDBHost = append(withoutDBHost,
			// Override the DB host to point to global cloudsql
			corev1.EnvVar{
				Name:  "DB_HOST",
				Value: cloudsql.ComponentGlobal,
			},
		)

		containerEnvVars = withoutDBHost
	}

	return containerEnvVars
}

func filterOutEnvVars(name string, vars []corev1.EnvVar) []corev1.EnvVar {
	var filtered []corev1.EnvVar
	for _, v := range vars {
		if v.Name == name {
			continue
		}

		filtered = append(filtered, v)
	}

	return filtered
}

func dbWaiter(ctx *common.RenderContext) v1.Container {
	databaseWaiter := common.DatabaseWaiterContainer(ctx)
	// Use updated env-vars, which in the case cloud-sql-proxy override default db conf

	databaseWaiter.Env = dbEnvVars(ctx)

	return *databaseWaiter
}

func spicedbEnvVars(ctx *common.RenderContext) []corev1.EnvVar {
	cfg := getExperimentalSpiceDBConfig(ctx)
	if cfg == nil {
		return nil
	}

	return common.MergeEnv(
		dbEnvVars(ctx),
		[]corev1.EnvVar{
			{
				Name:  "SPICEDB_DATASTORE_CONN_URI",
				Value: "$(DB_USERNAME):$(DB_PASSWORD)@tcp($(DB_HOST):$(DB_PORT))/authorization?parseTime=true",
			},
			{
				Name: "SPICEDB_GRPC_PRESHARED_KEY",
				ValueFrom: &corev1.EnvVarSource{
					SecretKeyRef: &corev1.SecretKeySelector{
						LocalObjectReference: corev1.LocalObjectReference{
							Name: cfg.SecretRef,
						},
						Key: SecretPresharedKeyName,
					},
				},
			},
		},
	)
}
