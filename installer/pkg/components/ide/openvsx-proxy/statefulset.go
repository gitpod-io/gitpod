// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package openvsx_proxy

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	appsv1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/pointer"
)

func statefulset(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(Component)
	// todo(sje): add redis

	configHash, err := common.ObjectHash(configmap(ctx))
	if err != nil {
		return nil, err
	}

	return []runtime.Object{&appsv1.StatefulSet{
		TypeMeta: common.TypeMetaStatefulSet,
		ObjectMeta: metav1.ObjectMeta{
			Name:      Component,
			Namespace: ctx.Namespace,
			Labels:    labels,
		},
		Spec: appsv1.StatefulSetSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: labels,
			},
			ServiceName: Component,
			// todo(sje): receive config value
			Replicas: pointer.Int32(1),
			Template: v1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Name:      Component,
					Namespace: ctx.Namespace,
					Labels:    labels,
					Annotations: map[string]string{
						common.AnnotationConfigChecksum: configHash,
					},
				},
				Spec: v1.PodSpec{
					Affinity:                      common.Affinity(cluster.AffinityLabelIDE),
					ServiceAccountName:            Component,
					EnableServiceLinks:            pointer.Bool(false),
					DNSPolicy:                     "ClusterFirst",
					RestartPolicy:                 "Always",
					TerminationGracePeriodSeconds: pointer.Int64(30),
					Volumes: []v1.Volume{{
						Name: "config",
						VolumeSource: v1.VolumeSource{
							ConfigMap: &v1.ConfigMapVolumeSource{
								LocalObjectReference: v1.LocalObjectReference{Name: fmt.Sprintf("%s-config", Component)},
							},
						},
					}},
					Containers: []v1.Container{{
						Name:  Component,
						Image: common.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.OpenVSXProxy.Version),
						Args:  []string{"/config/config.json"},
						ReadinessProbe: &v1.Probe{
							Handler: v1.Handler{
								HTTPGet: &v1.HTTPGetAction{
									Path: "/openvsx-proxy-status",
									Port: intstr.IntOrString{IntVal: ContainerPort},
								},
							},
						},
						ImagePullPolicy: v1.PullIfNotPresent,
						Resources: v1.ResourceRequirements{
							Requests: v1.ResourceList{
								"cpu":    resource.MustParse("1m"),
								"memory": resource.MustParse("2.25Gi"),
							},
						},
						Ports: []v1.ContainerPort{{
							Name:          PortName,
							ContainerPort: ContainerPort,
						}, {
							Name:          PrometheusPortName,
							ContainerPort: PrometheusPort,
						}},
						VolumeMounts: []v1.VolumeMount{{
							Name:      "config",
							MountPath: "/config",
						}},
						Env: common.MergeEnv(
							common.DefaultEnv(&ctx.Config),
						),
					}},
				},
			},
		},
	}}, nil
}
