// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package openvsx_proxy

import (
	"fmt"

	appsv1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/pointer"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
)

func statefulset(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.CustomizeLabel(ctx, Component, common.TypeMetaStatefulSet)
	// todo(sje): add redis

	configHash, err := common.ObjectHash(configmap(ctx))
	if err != nil {
		return nil, err
	}

	volumeClaimTemplates := []v1.PersistentVolumeClaim{
		{
			ObjectMeta: metav1.ObjectMeta{
				Name:   "redis-data",
				Labels: common.DefaultLabels(Component),
			},
			Spec: v1.PersistentVolumeClaimSpec{
				AccessModes: []v1.PersistentVolumeAccessMode{
					v1.ReadWriteOnce,
				},
				Resources: v1.VolumeResourceRequirements{
					Requests: v1.ResourceList{
						"storage": resource.MustParse("8Gi"),
					},
				},
			},
		},
	}

	volumes := []v1.Volume{
		{
			Name: "config",
			VolumeSource: v1.VolumeSource{
				ConfigMap: &v1.ConfigMapVolumeSource{
					LocalObjectReference: v1.LocalObjectReference{Name: fmt.Sprintf("%s-config", Component)},
				},
			},
		},
	}

	if ctx.Config.OpenVSX.Proxy != nil && ctx.Config.OpenVSX.Proxy.DisablePVC {
		volumeClaimTemplates = nil
		volumes = append(volumes, *common.NewEmptyDirVolume("redis-data"))
	}

	const redisContainerName = "redis"

	var proxyEnvVars []v1.EnvVar

	_ = ctx.WithExperimental(func(cfg *experimental.Config) error {
		proxyConfig := cfg.WebApp.ProxySettings
		if proxyConfig != nil {
			proxyEnvVars = []v1.EnvVar{
				{
					Name:  "HTTP_PROXY",
					Value: proxyConfig.HttpProxy,
				},
				{
					Name:  "HTTPS_PROXY",
					Value: proxyConfig.HttpsProxy,
				},
				{
					Name:  "NO_PROXY",
					Value: proxyConfig.NoProxy,
				},
			}
		}
		return nil
	})

	return []runtime.Object{&appsv1.StatefulSet{
		TypeMeta: common.TypeMetaStatefulSet,
		ObjectMeta: metav1.ObjectMeta{
			Name:        Component,
			Namespace:   ctx.Namespace,
			Labels:      labels,
			Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaConfigmap),
		},
		Spec: appsv1.StatefulSetSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: common.DefaultLabels(Component),
			},
			ServiceName: Component,
			// todo(sje): receive config value
			Replicas: common.Replicas(ctx, Component),
			Template: v1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Name:      Component,
					Namespace: ctx.Namespace,
					Labels:    labels,
					Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaConfigmap, func() map[string]string {
						return map[string]string{
							common.AnnotationConfigChecksum: configHash,
						}
					}),
				},
				Spec: v1.PodSpec{
					Affinity:                      cluster.WithNodeAffinity(cluster.AffinityLabelIDE),
					ServiceAccountName:            Component,
					EnableServiceLinks:            pointer.Bool(false),
					DNSPolicy:                     v1.DNSClusterFirst,
					RestartPolicy:                 v1.RestartPolicyAlways,
					TerminationGracePeriodSeconds: pointer.Int64(30),
					Volumes:                       volumes,
					Containers: []v1.Container{{
						Name:  Component,
						Image: ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.OpenVSXProxy.Version),
						Args:  []string{"/config/config.json"},
						ReadinessProbe: &v1.Probe{
							ProbeHandler: v1.ProbeHandler{
								HTTPGet: &v1.HTTPGetAction{
									Path: "/openvsx-proxy-status",
									Port: intstr.IntOrString{IntVal: ContainerPort},
								},
							},
						},
						SecurityContext: &v1.SecurityContext{
							AllowPrivilegeEscalation: pointer.Bool(false),
						},
						ImagePullPolicy: v1.PullIfNotPresent,
						Resources: common.ResourceRequirements(ctx, Component, Component, v1.ResourceRequirements{
							Requests: v1.ResourceList{
								"cpu":    resource.MustParse("1m"),
								"memory": resource.MustParse("150Mi"),
							},
						}),
						Ports: []v1.ContainerPort{{
							Name:          PortName,
							ContainerPort: ContainerPort,
						}, {
							Name:          baseserver.BuiltinMetricsPortName,
							ContainerPort: baseserver.BuiltinMetricsPort,
						}},
						VolumeMounts: []v1.VolumeMount{{
							Name:      "config",
							MountPath: "/config",
						}},
						Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
							common.DefaultEnv(&ctx.Config),
							common.ConfigcatEnv(ctx),
							proxyEnvVars,
						)),
					}, {
						Name:  redisContainerName,
						Image: ctx.ImageName(common.ThirdPartyContainerRepo(ctx.Config.Repository, common.DockerRegistryURL), "library/redis", "6.2"),
						Command: []string{
							"redis-server",
							"/config/redis.conf",
						},
						Env: []v1.EnvVar{{
							Name:  "MASTER",
							Value: "true",
						}},
						ImagePullPolicy: "IfNotPresent",
						Ports: []v1.ContainerPort{{
							ContainerPort: 6379,
						}},
						SecurityContext: &v1.SecurityContext{
							AllowPrivilegeEscalation: pointer.Bool(false),
						},
						Resources: common.ResourceRequirements(ctx, Component, redisContainerName, v1.ResourceRequirements{
							Requests: v1.ResourceList{
								"cpu":    resource.MustParse("1m"),
								"memory": resource.MustParse("150Mi"),
							},
						}),
						VolumeMounts: []v1.VolumeMount{{
							Name:      "config",
							MountPath: "/config",
						}, {
							Name:      "redis-data",
							MountPath: "/data",
						}},
					}, *common.KubeRBACProxyContainer(ctx),
					},
				},
			},
			VolumeClaimTemplates: volumeClaimTemplates,
		}},
	}, nil
}
