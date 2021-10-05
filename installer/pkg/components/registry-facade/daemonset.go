// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registryfacade

import (
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

	var certSecretsVolume corev1.Volume
	var certSecretsVolumeMount corev1.VolumeMount
	if ctx.Config.Certificate.Name != "" {
		name := "config-certificates"
		certSecretsVolume = corev1.Volume{
			Name: name,
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: ctx.Config.Certificate.Name,
				},
			},
		}

		certSecretsVolumeMount = corev1.VolumeMount{
			Name:      name,
			MountPath: "/mnt/certificates",
		}
	}

	// todo(sje): get value from workspace pull secret
	var pullSecretVolume corev1.Volume
	var pullSecretVolumeMount corev1.VolumeMount
	if *ctx.Config.ContainerRegistry.InCluster {
		name := "pull-secret"
		pullSecretVolume = corev1.Volume{
			Name: name,
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: dockerregistry.BuiltInRegistrySecret,
				},
			},
		}

		pullSecretVolumeMount = corev1.VolumeMount{
			Name:      name,
			MountPath: "/mnt/pull-secret.json",
			SubPath:   ".dockerconfigjson",
		}
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
				},
				Spec: corev1.PodSpec{
					PriorityClassName: "system-node-critical",
					// todo(sje): do we need affinity?
					Affinity:                      &corev1.Affinity{},
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
							Name:          "registry",
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
						VolumeMounts: []corev1.VolumeMount{{
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
						}, pullSecretVolumeMount, certSecretsVolumeMount},
					}, *common.KubeRBACProxyContainer()},
					Volumes: []corev1.Volume{{
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
					}, pullSecretVolume, certSecretsVolume},
				},
			},
		},
	}}, nil
}
