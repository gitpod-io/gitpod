// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package image_builder_mk3

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"

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

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.CustomizeLabel(ctx, Component, common.TypeMetaDeployment)

	var hashObj []runtime.Object
	if objs, err := configmap(ctx); err != nil {
		return nil, err
	} else {
		hashObj = append(hashObj, objs...)
	}

	secretName, err := pullSecretName(ctx)
	if err != nil {
		return nil, err
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
		{
			Name: "pull-secret",
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: secretName,
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
		{
			Name:      "pull-secret",
			MountPath: PullSecretFile,
			SubPath:   ".dockerconfigjson",
		},
	}
	if vol, mnt, _, ok := common.CustomCACertVolume(ctx); ok {
		volumes = append(volumes, *vol)
		volumeMounts = append(volumeMounts, *mnt)
	}

	var nodeAffinity = cluster.AffinityLabelMeta
	if ctx.Config.Kind == config.InstallationWorkspace {
		nodeAffinity = cluster.AffinityLabelWorkspaceServices
	}

	return []runtime.Object{&appsv1.Deployment{
		TypeMeta: common.TypeMetaDeployment,
		ObjectMeta: metav1.ObjectMeta{
			Name:        Component,
			Namespace:   ctx.Namespace,
			Labels:      labels,
			Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaDeployment),
		},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{MatchLabels: common.DefaultLabels(Component)},
			Replicas: common.Replicas(ctx, Component),
			Strategy: common.DeploymentStrategy,
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Name:      Component,
					Namespace: ctx.Namespace,
					Labels:    labels,
					Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaDeployment, func() map[string]string {
						return map[string]string{
							common.AnnotationConfigChecksum: configHash,
						}
					}),
				},
				Spec: corev1.PodSpec{
					Affinity:                      common.NodeAffinity(nodeAffinity),
					ServiceAccountName:            Component,
					EnableServiceLinks:            pointer.Bool(false),
					DNSPolicy:                     "ClusterFirst",
					RestartPolicy:                 "Always",
					TerminationGracePeriodSeconds: pointer.Int64(30),
					Volumes:                       volumes,
					InitContainers: []corev1.Container{
						*common.InternalCAContainer(ctx),
					},
					Containers: []corev1.Container{{
						Name:            Component,
						Image:           ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.ImageBuilderMk3.Version),
						ImagePullPolicy: corev1.PullIfNotPresent,
						Args: []string{
							"run",
							"--config",
							"/config/image-builder.json",
						},
						Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
							common.DefaultEnv(&ctx.Config),
							common.WorkspaceTracingEnv(ctx, Component),
						)),
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
							Privileged:               pointer.Bool(false),
							AllowPrivilegeEscalation: pointer.Bool(false),
							RunAsUser:                pointer.Int64(33333),
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
