// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package agentsmith

import (
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsmanagermk2 "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager-mk2"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func daemonset(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.CustomizeLabel(ctx, Component, common.TypeMetaDaemonset)

	configHash, err := common.ObjectHash(configmap(ctx))
	if err != nil {
		return nil, err
	}

	return []runtime.Object{&appsv1.DaemonSet{
		TypeMeta: common.TypeMetaDaemonset,
		ObjectMeta: metav1.ObjectMeta{
			Name:      Component,
			Namespace: ctx.Namespace,
			Labels:    labels,
			Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaDaemonset, func() map[string]string {
				return map[string]string{
					common.AnnotationConfigChecksum: configHash,
				}
			}),
		},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: common.DefaultLabels(Component)},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Name:        Component,
					Labels:      labels,
					Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaDaemonset),
				},
				Spec: corev1.PodSpec{
					Affinity:                      cluster.WithNodeAffinity(cluster.AffinityLabelWorkspacesRegular, cluster.AffinityLabelWorkspacesHeadless),
					ServiceAccountName:            Component,
					HostPID:                       true,
					EnableServiceLinks:            pointer.Bool(false),
					DNSPolicy:                     corev1.DNSClusterFirst,
					RestartPolicy:                 corev1.RestartPolicyAlways,
					TerminationGracePeriodSeconds: pointer.Int64(30),
					Containers: []corev1.Container{{
						Name:            Component,
						Image:           ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.AgentSmith.Version),
						ImagePullPolicy: corev1.PullIfNotPresent,
						Args:            []string{"run", "--config", "/config/config.json"},
						Resources: common.ResourceRequirements(ctx, Component, Component, corev1.ResourceRequirements{
							Requests: corev1.ResourceList{
								"cpu":    resource.MustParse("100m"),
								"memory": resource.MustParse("32Mi"),
							},
						}),
						VolumeMounts: []corev1.VolumeMount{
							{
								Name:      "config",
								MountPath: "/config",
							},
							{
								Name:      "wsman-tls-certs",
								MountPath: "/wsman-certs",
								ReadOnly:  true,
							},
							common.CAVolumeMount(),
						},
						Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
							common.DefaultEnv(&ctx.Config),
							common.WorkspaceTracingEnv(ctx, Component),
							common.NodeNameEnv(ctx),
						)),
						SecurityContext: &corev1.SecurityContext{
							Privileged: pointer.Bool(true),
							ProcMount:  func() *corev1.ProcMountType { r := corev1.DefaultProcMount; return &r }(),
						},
					},
						*common.KubeRBACProxyContainer(ctx),
					},
					Volumes: []corev1.Volume{
						{
							Name: "config",
							VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{
								LocalObjectReference: corev1.LocalObjectReference{Name: Component},
							}},
						},
						{
							Name: "wsman-tls-certs",
							VolumeSource: corev1.VolumeSource{
								Secret: &corev1.SecretVolumeSource{
									SecretName: wsmanagermk2.TLSSecretNameClient,
								},
							},
						},
						common.CAVolume(),
					},
				},
			},
			UpdateStrategy: common.DaemonSetRolloutStrategy(),
		},
	}}, nil
}
