// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package agentsmith

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"

	"github.com/hexops/valast"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func daemonset(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(Component)

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
					// todo(sje): do we need affinity?
					Affinity:                      &corev1.Affinity{},
					ServiceAccountName:            Component,
					HostPID:                       true,
					EnableServiceLinks:            pointer.Bool(false),
					DNSPolicy:                     "ClusterFirst",
					RestartPolicy:                 "Always",
					TerminationGracePeriodSeconds: pointer.Int64(30),
					Containers: []corev1.Container{{
						Name:            Component,
						Image:           common.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.AgentSmith.Version),
						ImagePullPolicy: corev1.PullIfNotPresent,
						Args:            []string{"run", "-v", "--config", "/config/config.json"},
						Resources: corev1.ResourceRequirements{
							Requests: corev1.ResourceList{
								"cpu":    resource.MustParse("100m"),
								"memory": resource.MustParse("32Mi"),
							},
						},
						VolumeMounts: []corev1.VolumeMount{{
							Name:      "config",
							MountPath: "/config",
						}},
						Env: common.MergeEnv(
							common.DefaultEnv(&ctx.Config),
							common.TracingEnv(&ctx.Config),
							[]corev1.EnvVar{{
								Name: "NODENAME",
								ValueFrom: &corev1.EnvVarSource{
									FieldRef: &corev1.ObjectFieldSelector{FieldPath: "spec.nodeName"},
								},
							}},
						),
						SecurityContext: &corev1.SecurityContext{
							Privileged: pointer.Bool(true),
							ProcMount:  valast.Addr(corev1.DefaultProcMount).(*corev1.ProcMountType),
						},
					}, *common.KubeRBACProxyContainer()},
					Volumes: []corev1.Volume{{
						Name: "config",
						VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{
							LocalObjectReference: corev1.LocalObjectReference{Name: Component},
						}},
					}},
				},
			},
		},
	}}, nil
}
