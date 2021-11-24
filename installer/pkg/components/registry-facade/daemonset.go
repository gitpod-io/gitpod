// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registryfacade

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
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

func daemonset(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(Component)

	var hashObj []runtime.Object
	if objs, err := configmap(ctx); err != nil {
		return nil, err
	} else {
		hashObj = append(hashObj, objs...)
	}

	var volumes []corev1.Volume
	var volumeMounts []corev1.VolumeMount

	if ctx.Config.Certificate.Name != "" {
		name := "config-certificates"
		volumes = append(volumes, corev1.Volume{
			Name: name,
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: ctx.Config.Certificate.Name,
				},
			},
		})

		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      name,
			MountPath: "/mnt/certificates",
		})
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

	name := "pull-secret"
	var secretName string
	if pointer.BoolDeref(ctx.Config.ContainerRegistry.InCluster, false) {
		secretName = dockerregistry.BuiltInRegistryAuth
	} else if ctx.Config.ContainerRegistry.External != nil {
		secretName = ctx.Config.ContainerRegistry.External.Certificate.Name
	} else {
		return nil, fmt.Errorf("%s: invalid container registry config", Component)
	}

	return []runtime.Object{&appsv1.DaemonSet{
		TypeMeta: common.TypeMetaDaemonset,
		ObjectMeta: metav1.ObjectMeta{
			Name:      Component,
			Namespace: ctx.Namespace,
			Labels:    labels,
		},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: labels},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Name:   Component,
					Labels: labels,
					Annotations: map[string]string{
						common.AnnotationConfigChecksum: configHash,
					},
				},
				Spec: corev1.PodSpec{
					PriorityClassName:             common.SystemNodeCritical,
					Affinity:                      common.Affinity(cluster.AffinityLabelWorkspacesRegular, cluster.AffinityLabelWorkspacesHeadless),
					ServiceAccountName:            Component,
					EnableServiceLinks:            pointer.Bool(false),
					DNSPolicy:                     "ClusterFirst",
					RestartPolicy:                 "Always",
					TerminationGracePeriodSeconds: pointer.Int64(30),
					Containers: []corev1.Container{{
						Name:            Component,
						Image:           common.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.RegistryFacade.Version),
						ImagePullPolicy: corev1.PullIfNotPresent,
						Args:            []string{"run", "-v", "/mnt/config/config.json"},
						Resources: corev1.ResourceRequirements{
							Requests: corev1.ResourceList{
								"cpu":    resource.MustParse("100m"),
								"memory": resource.MustParse("32Mi"),
							},
						},
						Ports: []corev1.ContainerPort{{
							Name:          ContainerPortName,
							ContainerPort: ContainerPort,
							HostPort:      ServicePort,
						}},
						SecurityContext: &corev1.SecurityContext{
							Privileged: pointer.Bool(false),
							RunAsUser:  pointer.Int64(1000),
						},
						Env: common.MergeEnv(
							common.DefaultEnv(&ctx.Config),
							common.TracingEnv(&ctx.Config),
							[]corev1.EnvVar{{
								Name:  "GRPC_GO_RETRY",
								Value: "on",
							}},
						),
						VolumeMounts: append([]corev1.VolumeMount{{
							Name:      "cache",
							MountPath: "/mnt/cache",
						}, {
							Name:      "config",
							MountPath: "/mnt/config",
							ReadOnly:  true,
						}, {
							Name:      "ws-manager-client-tls-certs",
							MountPath: "/ws-manager-client-tls-certs",
							ReadOnly:  true,
						}, {
							Name:      name,
							MountPath: "/mnt/pull-secret.json",
							SubPath:   ".dockerconfigjson",
						}}, volumeMounts...),
					}, *common.KubeRBACProxyContainer()},
					Volumes: append([]corev1.Volume{{
						Name:         "cache",
						VolumeSource: corev1.VolumeSource{EmptyDir: &corev1.EmptyDirVolumeSource{}},
					}, {
						Name: "config",
						VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{
							LocalObjectReference: corev1.LocalObjectReference{Name: Component},
						}},
					}, {
						Name: "ws-manager-client-tls-certs",
						VolumeSource: corev1.VolumeSource{
							Secret: &corev1.SecretVolumeSource{
								SecretName: wsmanager.TLSSecretNameClient,
							},
						},
					}, {
						Name: name,
						VolumeSource: corev1.VolumeSource{
							Secret: &corev1.SecretVolumeSource{
								SecretName: secretName,
							},
						},
					}}, volumes...),
				},
			},
		},
	}}, nil
}
