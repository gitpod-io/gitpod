// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package registryfacade

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	dockerregistry "github.com/gitpod-io/gitpod/installer/pkg/components/docker-registry"
	wsmanagermk2 "github.com/gitpod-io/gitpod/installer/pkg/components/ws-manager-mk2"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/pointer"
)

const wsManagerMk2ClientTlsVolume = "ws-manager-mk2-client-tls-certs"

func daemonset(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.CustomizeLabel(ctx, Component, common.TypeMetaDaemonset)

	var hashObj []runtime.Object
	if objs, err := configmap(ctx); err != nil {
		return nil, err
	} else {
		hashObj = append(hashObj, objs...)
	}

	var (
		volumes = []corev1.Volume{
			{
				Name: "config-certificates",
				VolumeSource: corev1.VolumeSource{
					Secret: &corev1.SecretVolumeSource{
						SecretName: "builtin-registry-facade-cert",
					},
				},
			},
			{
				Name: wsManagerMk2ClientTlsVolume,
				VolumeSource: corev1.VolumeSource{
					Secret: &corev1.SecretVolumeSource{
						SecretName: wsmanagermk2.TLSSecretNameClient,
					},
				},
			},
		}
		volumeMounts = []corev1.VolumeMount{
			{
				Name:      "config-certificates",
				MountPath: "/mnt/certificates",
			},
			{
				Name:      wsManagerMk2ClientTlsVolume,
				MountPath: "/ws-manager-mk2-client-tls-certs",
				ReadOnly:  true,
			},
		}
	)

	if objs, err := common.DockerRegistryHash(ctx); err != nil {
		return nil, err
	} else {
		hashObj = append(hashObj, objs...)
	}

	//nolint:typecheck
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

	var envvars []corev1.EnvVar
	containerdConfigDir := "/etc/containerd"
	err = ctx.WithExperimental(func(ucfg *experimental.Config) error {
		if ucfg.Workspace == nil {
			return nil
		}

		if ucfg.Workspace.RegistryFacade.IPFSCache.Enabled && !ucfg.Workspace.RegistryFacade.RedisCache.Enabled {
			return fmt.Errorf("IPFS cache requires Redis")
		}

		if ucfg.Workspace.RegistryFacade.IPFSCache.Enabled {
			envvars = []corev1.EnvVar{
				{
					Name: "IPFS_HOST",
					ValueFrom: &corev1.EnvVarSource{
						FieldRef: &corev1.ObjectFieldSelector{
							FieldPath: "status.hostIP",
						},
					},
				},
			}
		}

		if ucfg.Workspace.RegistryFacade.RedisCache.Enabled {
			if scr := ucfg.Workspace.RegistryFacade.RedisCache.PasswordSecret; scr != "" {
				envvars = append(envvars, corev1.EnvVar{
					Name: "REDIS_PASSWORD",
					ValueFrom: &corev1.EnvVarSource{
						SecretKeyRef: &corev1.SecretKeySelector{
							LocalObjectReference: corev1.LocalObjectReference{
								Name: scr,
							},
							Key: "password",
						},
					},
				})
			}
		}

		if ucfg.Workspace.RegistryFacade.ContainerdConfigDir != "" {
			containerdConfigDir = ucfg.Workspace.RegistryFacade.ContainerdConfigDir
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	initContainers := []corev1.Container{
		{
			Name:  "setup",
			Image: ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.RegistryFacade.Version), ImagePullPolicy: corev1.PullIfNotPresent,
			Args: []string{
				"setup",
				"--hostfs=/mnt/dst",
				fmt.Sprintf("--hostname=reg.%s", ctx.Config.Domain),
				fmt.Sprintf("--port=%v", ServicePort),
				fmt.Sprintf("--containerd-config-dir=%s", containerdConfigDir),
			},
			SecurityContext: &corev1.SecurityContext{RunAsUser: pointer.Int64(0)},
			VolumeMounts: []corev1.VolumeMount{
				{
					Name:      "hostfs",
					MountPath: "/mnt/dst",
				},
				{
					Name:      "ca-certificate",
					MountPath: "/usr/local/share/ca-certificates/gitpod-ca.crt",
					SubPath:   "gitpod-ca.crt",
					ReadOnly:  true,
				},
			},
			Env: common.ProxyEnv(&ctx.Config),
		},
	}

	return []runtime.Object{&appsv1.DaemonSet{
		TypeMeta: common.TypeMetaDaemonset,
		ObjectMeta: metav1.ObjectMeta{
			Name:        Component,
			Namespace:   ctx.Namespace,
			Labels:      labels,
			Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaDaemonset),
		},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: common.DefaultLabels(Component)},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Name:   Component,
					Labels: labels,
					Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaDaemonset, func() map[string]string {
						return map[string]string{
							common.AnnotationConfigChecksum: configHash,
						}
					}),
				},
				Spec: corev1.PodSpec{
					PriorityClassName:             common.SystemNodeCritical,
					Affinity:                      cluster.WithNodeAffinity(cluster.AffinityLabelWorkspacesRegular, cluster.AffinityLabelWorkspacesHeadless),
					ServiceAccountName:            Component,
					EnableServiceLinks:            pointer.Bool(false),
					DNSPolicy:                     corev1.DNSClusterFirst,
					RestartPolicy:                 corev1.RestartPolicyAlways,
					TerminationGracePeriodSeconds: pointer.Int64(30),
					InitContainers:                initContainers,
					Tolerations: []corev1.Toleration{
						{
							Operator: "Exists",
						},
					},
					Containers: []corev1.Container{{
						Name:            Component,
						Image:           ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.RegistryFacade.Version),
						ImagePullPolicy: corev1.PullIfNotPresent,
						Args:            []string{"run", "/mnt/config/config.json"},
						Resources: common.ResourceRequirements(ctx, Component, Component, corev1.ResourceRequirements{
							Requests: corev1.ResourceList{
								"cpu":    resource.MustParse("100m"),
								"memory": resource.MustParse("32Mi"),
							},
						}),
						Ports: []corev1.ContainerPort{{
							Name:          ContainerPortName,
							ContainerPort: ServicePort,
							HostPort:      ServicePort,
						}},
						SecurityContext: &corev1.SecurityContext{
							Privileged:               pointer.Bool(false),
							AllowPrivilegeEscalation: pointer.Bool(false),
							RunAsUser:                pointer.Int64(1000),
						},
						Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
							common.DefaultEnv(&ctx.Config),
							common.WorkspaceTracingEnv(ctx, Component),
							[]corev1.EnvVar{
								{
									Name:  "GRPC_GO_RETRY",
									Value: "on",
								},
							},
							envvars,
						)),
						VolumeMounts: append(
							[]corev1.VolumeMount{
								{
									Name:      "cache",
									MountPath: "/mnt/cache",
								},
								{
									Name:      "config",
									MountPath: "/mnt/config",
									ReadOnly:  true,
								},
								{
									Name:      name,
									MountPath: "/mnt/pull-secret",
								},
								common.CAVolumeMount(),
							},
							volumeMounts...,
						),
						ReadinessProbe: &corev1.Probe{
							ProbeHandler: corev1.ProbeHandler{
								HTTPGet: &corev1.HTTPGetAction{
									Path: "/ready",
									Port: intstr.IntOrString{IntVal: ReadinessPort},
								},
							},
							InitialDelaySeconds: 10,
							PeriodSeconds:       5,
							TimeoutSeconds:      2,
							SuccessThreshold:    2,
							FailureThreshold:    5,
						},
						LivenessProbe: &corev1.Probe{
							ProbeHandler: corev1.ProbeHandler{
								HTTPGet: &corev1.HTTPGetAction{
									Path: "/live",
									Port: intstr.IntOrString{IntVal: ReadinessPort},
								},
							},
							InitialDelaySeconds: 5,
							PeriodSeconds:       10,
							TimeoutSeconds:      2,
							SuccessThreshold:    1,
							FailureThreshold:    3,
						},
					},
						*common.KubeRBACProxyContainer(ctx),
					},
					Volumes: append([]corev1.Volume{
						{
							Name:         "cache",
							VolumeSource: corev1.VolumeSource{EmptyDir: &corev1.EmptyDirVolumeSource{}},
						},
						{
							Name: "config",
							VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{
								LocalObjectReference: corev1.LocalObjectReference{Name: Component},
							}},
						},
						{
							Name: name,
							VolumeSource: corev1.VolumeSource{
								Secret: &corev1.SecretVolumeSource{
									SecretName: secretName,
									Items:      []corev1.KeyToPath{{Key: ".dockerconfigjson", Path: "pull-secret.json"}},
								},
							},
						},
						{
							Name: "hostfs",
							VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
								Path: "/",
							}},
						},
						{
							Name: "ca-certificate",
							VolumeSource: corev1.VolumeSource{
								ConfigMap: &corev1.ConfigMapVolumeSource{
									LocalObjectReference: corev1.LocalObjectReference{Name: "gitpod-ca"},
								},
							},
						},
						common.CAVolume(),
					}, volumes...),
				},
			},
			UpdateStrategy: common.DaemonSetRolloutStrategy(),
		},
	}}, nil
}
