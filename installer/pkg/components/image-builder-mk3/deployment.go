// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package image_builder_mk3

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsmanager "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

// todo(sje): work out what to do here - this may be better in common, or to autogenerate on everything
func getChecksum(path string) string {
	hash := sha256.Sum256([]byte(path))

	return hex.EncodeToString(hash[:])
}

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(Component)

	annotations := map[string]string{
		// todo(sje): put the configmap
		"checksum/image-builder-mk3-configmap": getChecksum("image-builder-mk3-configmap.yaml"),
	}

	// todo(sje): make conditional based on Docker Registry being included
	// todo(sje): get SHA256Sum of registry secret
	annotations["checksum/builtin-registry-auth"] = getChecksum("@todo")

	var volumes []corev1.Volume
	var volumeMounts []corev1.VolumeMount

	// todo(sje): make conditional
	// todo(sje): get value from workspace pull secret
	volumeMounts = append(volumeMounts, corev1.VolumeMount{
		Name:      "pull-secret",
		MountPath: PullSecretFile,
		SubPath:   ".dockerconfigjson",
	})
	volumes = append(volumes, corev1.Volume{
		Name: "pull-secret",
		VolumeSource: corev1.VolumeSource{Secret: &corev1.SecretVolumeSource{
			SecretName: "",
		}},
	})

	return []runtime.Object{&appsv1.Deployment{
		TypeMeta: common.TypeMetaDeployment,
		ObjectMeta: metav1.ObjectMeta{
			Name:      Component,
			Namespace: ctx.Namespace,
			Labels:    labels,
		},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"Component": Component},
			},
			// todo(sje): receive config value
			Replicas: pointer.Int32(1),
			Strategy: common.DeploymentStrategy,
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Name:        Component,
					Namespace:   ctx.Namespace,
					Labels:      labels,
					Annotations: annotations,
				},
				Spec: corev1.PodSpec{
					Affinity:                      &corev1.Affinity{},
					ServiceAccountName:            Component,
					EnableServiceLinks:            pointer.Bool(false),
					DNSPolicy:                     "ClusterFirst",
					RestartPolicy:                 "Always",
					TerminationGracePeriodSeconds: pointer.Int64(30),
					Volumes: append([]corev1.Volume{{
						Name: "configuration",
						VolumeSource: corev1.VolumeSource{
							ConfigMap: &corev1.ConfigMapVolumeSource{
								LocalObjectReference: corev1.LocalObjectReference{Name: fmt.Sprintf("%s-config", Component)},
							},
						},
					}, {
						Name: "authkey",
						VolumeSource: corev1.VolumeSource{
							Secret: &corev1.SecretVolumeSource{
								SecretName: fmt.Sprintf("%s-authkey", Component),
							},
						},
					}, {
						Name: "wsman-tls-certs",
						VolumeSource: corev1.VolumeSource{
							Secret: &corev1.SecretVolumeSource{
								SecretName: wsmanager.TLSSecretNameClient,
							},
						},
					}}, volumes...),
					Containers: []corev1.Container{{
						Name:            Component,
						Image:           common.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.ImageBuilderMk3.Version),
						ImagePullPolicy: corev1.PullIfNotPresent,
						Args: []string{
							"run",
							"--config",
							"/config/image-builder.json",
						},
						Env: common.MergeEnv(
							common.DefaultEnv(&ctx.Config),
							common.TracingEnv(&ctx.Config),
						),
						Resources: corev1.ResourceRequirements{
							Requests: corev1.ResourceList{
								"cpu":    resource.MustParse("100m"),
								"memory": resource.MustParse("200Mi"),
							},
						},
						Ports: []corev1.ContainerPort{{
							ContainerPort: RPCPort,
							Name:          "rpc",
						}},
						SecurityContext: &corev1.SecurityContext{
							Privileged: pointer.Bool(false),
							RunAsUser:  pointer.Int64(33333),
						},
						VolumeMounts: append([]corev1.VolumeMount{{
							Name:      "configuration",
							MountPath: "/config/image-builder.json",
							SubPath:   "image-builder.json",
						}, {
							Name:      "authkey",
							MountPath: "/config/authkey",
							SubPath:   "keyfile",
						}, {
							Name:      "wsman-tls-certs",
							MountPath: "/wsman-certs",
							ReadOnly:  true,
						}}, volumeMounts...),
					}, *common.KubeRBACProxyContainer()},
				},
			},
		},
	}}, nil
}
