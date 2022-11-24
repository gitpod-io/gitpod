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
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/pointer"
)

func daemonset(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.CustomizeLabel(ctx, Component, common.TypeMetaDaemonset)

	var hashObj []runtime.Object
	if objs, err := configmap(ctx); err != nil {
		return nil, err
	} else {
		hashObj = append(hashObj, objs...)
	}

	var (
		volumes      []corev1.Volume
		volumeMounts []corev1.VolumeMount
	)

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
	if ctx.Config.CustomCACert != nil && ctx.Config.CustomCACert.Name != "" {
		// Attach the custom CA certificate as registry-facade seems to talk to
		// the registry through the `proxy`
		volumeName := "custom-ca-cert"
		volumes = append(volumes, corev1.Volume{
			Name: volumeName,
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: ctx.Config.CustomCACert.Name,
					Items: []corev1.KeyToPath{
						{
							Key:  "ca.crt",
							Path: "ca.crt",
						},
					},
				},
			},
		})

		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			ReadOnly:  true,
			MountPath: "/etc/ssl/certs/proxy-ca.crt",
			SubPath:   "ca.crt",
			Name:      volumeName,
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

	var envvars []corev1.EnvVar
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

		if ucfg.Workspace.RegistryFacade.IPFSCache.Enabled {
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

		return nil
	})
	if err != nil {
		return nil, err
	}

	initContainers := []corev1.Container{
		*common.InternalCAContainer(ctx),
	}
	// Load `customCACert` into Kubelet's only if its self-signed
	if ctx.Config.CustomCACert != nil && ctx.Config.CustomCACert.Name != "" {
		initContainers = append(initContainers,
			*common.InternalCAContainer(ctx, func(c *corev1.Container) {
				c.Name = "update-containerd-certificates"
				c.Env = append(c.Env,
					corev1.EnvVar{
						Name: "GITPOD_CA_CERT",
						ValueFrom: &corev1.EnvVarSource{
							SecretKeyRef: &corev1.SecretKeySelector{
								Key: "ca.crt",
								LocalObjectReference: corev1.LocalObjectReference{
									Name: ctx.Config.CustomCACert.Name,
								},
							},
						},
					},
					corev1.EnvVar{
						// Install gitpod ca.crt in containerd to allow pulls from the host
						// https://github.com/containerd/containerd/blob/main/docs/hosts.md
						Name:  "SETUP_SCRIPT",
						Value: fmt.Sprintf(`TARGETS="docker containerd";for TARGET in $TARGETS;do mkdir -p /mnt/dst/etc/$TARGET/certs.d/reg.%s:%v && echo "$GITPOD_CA_CERT" > /mnt/dst/etc/$TARGET/certs.d/reg.%s:%v/ca.crt && echo "OK";done`, ctx.Config.Domain, ServicePort, ctx.Config.Domain, ServicePort),
					},
				)
				c.VolumeMounts = append(c.VolumeMounts,
					corev1.VolumeMount{
						Name:      "hostfs",
						MountPath: "/mnt/dst",
					},
				)
				c.Command = []string{"sh", "-c", "$(SETUP_SCRIPT)"}
			}),
		)
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
					Affinity:                      common.NodeAffinity(cluster.AffinityLabelWorkspacesRegular, cluster.AffinityLabelWorkspacesHeadless),
					ServiceAccountName:            Component,
					EnableServiceLinks:            pointer.Bool(false),
					DNSPolicy:                     "ClusterFirst",
					RestartPolicy:                 "Always",
					TerminationGracePeriodSeconds: pointer.Int64(30),
					InitContainers:                initContainers,
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
							ContainerPort: ContainerPort,
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
							common.NodeNameEnv(ctx),
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
									Name:      "ws-manager-client-tls-certs",
									MountPath: "/ws-manager-client-tls-certs",
									ReadOnly:  true,
								},
								{
									Name:      name,
									MountPath: "/mnt/pull-secret.json",
									SubPath:   ".dockerconfigjson",
								},
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
							InitialDelaySeconds: 5,
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
						{
							Name:  "node-labeler",
							Image: ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.RegistryFacade.Version),
							Command: []string{
								"/app/ready-probe-labeler",
								fmt.Sprintf("--label=gitpod.io/registry-facade_ready_ns_%v", ctx.Namespace),
								fmt.Sprintf(`--probe-url=http://localhost:%v/ready`, ReadinessPort),
							},
							Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
								common.NodeNameEnv(ctx),
								common.ProxyEnv(&ctx.Config),
							)),
							ImagePullPolicy: corev1.PullIfNotPresent,
							Lifecycle: &corev1.Lifecycle{
								PreStop: &corev1.LifecycleHandler{
									Exec: &corev1.ExecAction{
										Command: []string{
											"/app/ready-probe-labeler",
											fmt.Sprintf("--label=gitpod.io/registry-facade_ready_ns_%v", ctx.Namespace),
											"--shutdown",
										},
									},
								},
							},
						},
					},
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
					}, {
						Name: "hostfs",
						VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
							Path: "/",
						}},
					},
						*common.InternalCAVolume(),
						*common.NewEmptyDirVolume("cacerts"),
					}, volumes...),
				},
			},
		},
	}}, nil
}
