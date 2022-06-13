// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package image_builder_mk3

import (
	"fmt"

	"github.com/gitpod-io/gitpod/image-builder/api/config"
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	dockerregistry "github.com/gitpod-io/gitpod/installer/pkg/components/docker-registry"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func pullSecretName(ctx *common.RenderContext) (string, error) {
	var secretName string
	if pointer.BoolDeref(ctx.Config.ContainerRegistry.InCluster, false) {
		secretName = dockerregistry.BuiltInRegistryAuth
	} else if ctx.Config.ContainerRegistry.External != nil {
		secretName = ctx.Config.ContainerRegistry.External.Certificate.Name
	} else {
		return "", fmt.Errorf("%s: invalid container registry config", Component)
	}
	return secretName, nil
}

func pullSecrets(ctx *common.RenderContext) ([]config.PullSecret, error) {
	secretName, err := pullSecretName(ctx)
	if err != nil {
		return nil, err
	}

	var res []config.PullSecret
	res = append(res, config.PullSecret{
		Name:      secretName,
		MountPath: fmt.Sprintf("/config/pull-secret_%03d.json", len(res)),
	})

	_ = ctx.WithExperimental(func(ucfg *experimental.Config) error {
		if ucfg.Workspace == nil {
			return nil
		}
		for _, s := range ucfg.Workspace.ImageBuilderPullSecrets {
			res = append(res, config.PullSecret{
				Name:      s,
				MountPath: fmt.Sprintf("/config/pull-secret_%03d.json", len(res)),
			})
		}
		return nil
	})

	return res, nil
}

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(Component)

	var hashObj []runtime.Object
	if objs, err := configmap(ctx); err != nil {
		return nil, err
	} else {
		hashObj = append(hashObj, objs...)
	}

	if objs, err := common.DockerRegistryHash(ctx); err != nil {
		return nil, err
	} else {
		hashObj = append(hashObj, objs...)
	}

	configHash, err := common.ObjectHash(hashObj, nil)
	if err != nil {
		return nil, err
	}

	pss, err := pullSecrets(ctx)
	if err != nil {
		return nil, err
	}

	volumes := []corev1.Volume{
		{
			Name: "configuration",
			VolumeSource: corev1.VolumeSource{
				ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{Name: fmt.Sprintf("%s-config", Component)},
				},
			},
		},
		{
			Name: "wsman-tls-certs",
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: wsmanager.TLSSecretNameClient,
				},
			},
		},
		*common.InternalCAVolume(),
		*common.NewEmptyDirVolume("cacerts"),
	}
	volumeMounts := []corev1.VolumeMount{
		{
			Name:      "configuration",
			MountPath: "/config/image-builder.json",
			SubPath:   "image-builder.json",
		},
		{
			Name:      "wsman-tls-certs",
			MountPath: "/wsman-certs",
			ReadOnly:  true,
		},
	}
	if vol, mnt, _, ok := common.CustomCACertVolume(ctx); ok {
		volumes = append(volumes, *vol)
		volumeMounts = append(volumeMounts, *mnt)
	}
	for i, ps := range pss {
		vol := corev1.Volume{
			Name: fmt.Sprintf("pull-secret-%03d", i),
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: ps.Name,
				},
			},
		}
		volumes = append(volumes, vol)
		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      vol.Name,
			MountPath: ps.MountPath,
			SubPath:   ".dockerconfigjson",
		})
	}

	return []runtime.Object{&appsv1.Deployment{
		TypeMeta: common.TypeMetaDeployment,
		ObjectMeta: metav1.ObjectMeta{
			Name:      Component,
			Namespace: ctx.Namespace,
			Labels:    labels,
		},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{MatchLabels: labels},
			Replicas: common.Replicas(ctx, Component),
			Strategy: common.DeploymentStrategy,
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Name:      Component,
					Namespace: ctx.Namespace,
					Labels:    labels,
					Annotations: map[string]string{
						common.AnnotationConfigChecksum: configHash,
					},
				},
				Spec: corev1.PodSpec{
					Affinity:                      common.NodeAffinity(cluster.AffinityLabelMeta),
					ServiceAccountName:            Component,
					EnableServiceLinks:            pointer.Bool(false),
					DNSPolicy:                     "ClusterFirst",
					RestartPolicy:                 "Always",
					TerminationGracePeriodSeconds: pointer.Int64(30),
					Volumes:                       volumes,
					InitContainers: []corev1.Container{
						*common.InternalCAContainer(ctx),
					},
					Containers: []corev1.Container{
						{
							Name:            Component,
							Image:           ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.ImageBuilderMk3.Version),
							ImagePullPolicy: corev1.PullIfNotPresent,
							Args: []string{
								"run",
								"--config",
								"/config/image-builder.json",
							},
							Env: common.MergeEnv(
								common.DefaultEnv(&ctx.Config),
								common.WorkspaceTracingEnv(ctx),
							),
							Resources: common.ResourceRequirements(ctx, Component, Component, corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									"cpu":    resource.MustParse("100m"),
									"memory": resource.MustParse("200Mi"),
								},
							}),
							Ports: []corev1.ContainerPort{{
								ContainerPort: RPCPort,
								Name:          RPCPortName,
							}},
							SecurityContext: &corev1.SecurityContext{
								Privileged: pointer.Bool(false),
								RunAsUser:  pointer.Int64(33333),
							},
							VolumeMounts: volumeMounts,
						},
						*common.KubeRBACProxyContainer(ctx),
					},
				},
			},
		},
	}}, nil
}
