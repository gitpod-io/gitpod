// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package wsdaemon

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/shiftfs"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/pointer"
)

func daemonset(ctx *common.RenderContext) ([]runtime.Object, error) {
	cfg := ctx.Config
	labels := common.CustomizeLabel(ctx, Component, common.TypeMetaDaemonset)

	configHash, err := common.ObjectHash(configmap(ctx))
	if err != nil {
		return nil, err
	}

	initContainers := []corev1.Container{
		{
			Name:  "disable-kube-health-monitor",
			Image: ctx.ImageName(common.ThirdPartyContainerRepo(ctx.Config.Repository, common.DockerRegistryURL), "library/ubuntu", "20.04"),
			Command: []string{
				"/usr/bin/nsenter",
				"-t",
				"1",
				"-a",
				"/bin/bash",
				"-c",
			},
			Args: []string{`exec {BASH_XTRACEFD}>&1 # this causes 'set -x' to write to stdout insted of stderr
set -euExo pipefail
systemctl status kube-container-runtime-monitor.service || true
if [ "$(systemctl is-active kube-container-runtime-monitor.service)" == "active" ]
then
	echo "kube-container-runtime-monitor.service is active"
	systemctl stop kube-container-runtime-monitor.service
	systemctl disable kube-container-runtime-monitor.service
	systemctl status kube-container-runtime-monitor.service || true
else
	echo "kube-container-runtime-monitor.service is not active, not doing anything"
fi
`},
			SecurityContext: &corev1.SecurityContext{
				Privileged: pointer.Bool(true),
				ProcMount:  func() *corev1.ProcMountType { r := corev1.DefaultProcMount; return &r }(),
			},
			Env: common.ProxyEnv(&cfg),
		},
		{
			Name:  "seccomp-profile-installer",
			Image: ctx.ImageName(cfg.Repository, "seccomp-profile-installer", ctx.VersionManifest.Components.WSDaemon.UserNamespaces.SeccompProfileInstaller.Version),
			Command: []string{
				"/bin/sh",
				"-c",
				fmt.Sprintf("cp -f /installer/workspace_default.json /mnt/dst/workspace_default_%s.json", ctx.VersionManifest.Version),
			},
			VolumeMounts: []corev1.VolumeMount{{
				Name:      "hostseccomp",
				MountPath: "/mnt/dst",
			}},
			SecurityContext: &corev1.SecurityContext{Privileged: pointer.Bool(true)},
		},
		{
			Name:  "sysctl",
			Image: ctx.ImageName(cfg.Repository, "ws-daemon", ctx.VersionManifest.Components.WSDaemon.Version),
			Command: []string{
				"sh",
				"-c",
				`(
	echo "running sysctls" &&
	sysctl -w net.core.somaxconn=4096 &&
	sysctl -w "net.ipv4.ip_local_port_range=5000 65000" &&
	sysctl -w "net.ipv4.tcp_tw_reuse=1" &&
	sysctl -w fs.inotify.max_user_watches=1000000 &&
	sysctl -w "kernel.dmesg_restrict=1" &&
	sysctl -w vm.unprivileged_userfaultfd=0
) && echo "done!" || echo "failed!"
`,
			},
			SecurityContext: &corev1.SecurityContext{Privileged: pointer.Bool(true)},
		},
	}

	if cfg.Workspace.Runtime.FSShiftMethod == config.FSShiftShiftFS {
		initContainers = append(initContainers, shiftfs.Container(ctx))
	}

	podSpec := corev1.PodSpec{
		Volumes: []corev1.Volume{
			{
				Name: "hostfs",
				VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
					Path: "/",
				}},
			},
			{
				Name: "working-area",
				VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
					Path: HostWorkingArea,
					Type: func() *corev1.HostPathType { r := corev1.HostPathDirectoryOrCreate; return &r }(),
				}},
			},
			{
				Name:         "tls-certs",
				VolumeSource: corev1.VolumeSource{Secret: &corev1.SecretVolumeSource{SecretName: TLSSecretName}},
			},
			{
				Name: "config",
				VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{
					LocalObjectReference: corev1.LocalObjectReference{Name: Component},
				}},
			},
			{
				Name: "containerd-socket",
				VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
					Path: ctx.Config.Workspace.Runtime.ContainerDSocket,
					Type: func() *corev1.HostPathType { r := corev1.HostPathSocket; return &r }(),
				}},
			},
			{
				Name: "node-fs0",
				VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
					Path: ctx.Config.Workspace.Runtime.ContainerDRuntimeDir,
					Type: func() *corev1.HostPathType { r := corev1.HostPathDirectory; return &r }(),
				}},
			},
			{
				Name: "node-mounts",
				VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
					Path: "/proc/mounts",
					Type: func() *corev1.HostPathType { r := corev1.HostPathFile; return &r }(),
				}},
			},
			{
				Name: "node-cgroups",
				VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
					Path: "/sys/fs/cgroup",
					Type: func() *corev1.HostPathType { r := corev1.HostPathDirectory; return &r }(),
				}},
			},
			{
				Name: "node-hosts",
				VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
					Path: "/etc/hosts",
					Type: func() *corev1.HostPathType { r := corev1.HostPathFile; return &r }(),
				}},
			},
			{
				Name: "node-linux-src",
				VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
					Path: "/usr/src",
					Type: func() *corev1.HostPathType { r := corev1.HostPathDirectory; return &r }(),
				}},
			},
			{
				Name:         "hostseccomp",
				VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{Path: "/var/lib/kubelet/seccomp"}},
			},
			{
				Name: "gcloud-tmp",
				VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
					Path: HostBackupPath,
					Type: func() *corev1.HostPathType { r := corev1.HostPathDirectoryOrCreate; return &r }(),
				}},
			},
		},
		InitContainers: initContainers,
		Containers: []corev1.Container{
			{
				Name:  Component,
				Image: ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.WSDaemon.Version),
				Args: []string{
					"run",
					"--config",
					"/config/config.json",
				},
				Ports: []corev1.ContainerPort{{
					Name:          "rpc",
					HostPort:      ServicePort,
					ContainerPort: ServicePort,
				}},
				Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
					common.DefaultEnv(&cfg),
					common.WorkspaceTracingEnv(ctx, Component),
					common.NodeNameEnv(ctx),
				)),
				Resources: common.ResourceRequirements(ctx, Component, Component, corev1.ResourceRequirements{Requests: corev1.ResourceList{
					"cpu":    resource.MustParse("500m"),
					"memory": resource.MustParse("4Gi"),
				}}),
				VolumeMounts: []corev1.VolumeMount{
					{
						Name:             "working-area",
						MountPath:        ContainerWorkingArea,
						MountPropagation: func() *corev1.MountPropagationMode { r := corev1.MountPropagationBidirectional; return &r }(),
					},
					{
						Name:      "config",
						MountPath: "/config",
					},
					{
						Name:      "containerd-socket",
						MountPath: "/mnt/containerd.sock",
					},
					{
						Name:      "node-fs0",
						MountPath: "/mnt/node0",
					},
					{
						Name:             "node-mounts",
						ReadOnly:         true,
						MountPath:        "/mnt/mounts",
						MountPropagation: func() *corev1.MountPropagationMode { r := corev1.MountPropagationHostToContainer; return &r }(),
					},
					{
						Name:             "node-cgroups",
						MountPath:        "/mnt/node-cgroups",
						MountPropagation: func() *corev1.MountPropagationMode { r := corev1.MountPropagationHostToContainer; return &r }(),
					},
					{
						Name:      "node-hosts",
						MountPath: "/mnt/hosts",
					},
					{
						Name:      "tls-certs",
						MountPath: "/certs",
					},
					{
						Name:      "gcloud-tmp",
						MountPath: "/mnt/sync-tmp",
					},
				},
				ImagePullPolicy: corev1.PullIfNotPresent,
				SecurityContext: &corev1.SecurityContext{
					Privileged: pointer.Bool(true),
				},
				ReadinessProbe: &corev1.Probe{
					ProbeHandler: corev1.ProbeHandler{
						HTTPGet: &corev1.HTTPGetAction{
							Path: "/ready",
							Port: intstr.IntOrString{IntVal: ReadinessPort},
						},
					},
					InitialDelaySeconds: 5,
					PeriodSeconds:       5,
					TimeoutSeconds:      1,
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
					TimeoutSeconds:      1,
					SuccessThreshold:    1,
					FailureThreshold:    5,
				},
			},
			*common.KubeRBACProxyContainer(ctx),
			{
				Name:  "node-labeler",
				Image: ctx.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.WSDaemon.Version),
				Command: []string{
					"/app/ready-probe-labeler",
					fmt.Sprintf("--label=gitpod.io/ws-daemon_ready_ns_%v", ctx.Namespace),
					fmt.Sprintf(`--probe-url=http://localhost:%v/ready`, ReadinessPort),
				},
				Env: common.CustomizeEnvvar(ctx, Component, common.MergeEnv(
					common.NodeNameEnv(ctx),
					common.ProxyEnv(&ctx.Config),
				)),
				ImagePullPolicy: corev1.PullIfNotPresent,
				SecurityContext: &corev1.SecurityContext{
					AllowPrivilegeEscalation: pointer.Bool(false),
				},
				LivenessProbe: &corev1.Probe{
					ProbeHandler: corev1.ProbeHandler{
						HTTPGet: &corev1.HTTPGetAction{
							Path: "/ready",
							Port: intstr.IntOrString{IntVal: ReadinessPort},
						},
					},
					InitialDelaySeconds: 5,
					PeriodSeconds:       2,
					TimeoutSeconds:      1,
					SuccessThreshold:    1,
					FailureThreshold:    3,
				},
				Lifecycle: &corev1.Lifecycle{
					PreStop: &corev1.LifecycleHandler{
						Exec: &corev1.ExecAction{
							Command: []string{
								"/app/ready-probe-labeler",
								fmt.Sprintf("--label=gitpod.io/ws-daemon_ready_ns_%v", ctx.Namespace),
								"--shutdown",
							},
						},
					},
				},
			},
		},
		RestartPolicy:                 "Always",
		TerminationGracePeriodSeconds: pointer.Int64(30),
		DNSPolicy:                     "ClusterFirst",
		ServiceAccountName:            Component,
		HostPID:                       true,
		Affinity:                      common.NodeAffinity(cluster.AffinityLabelWorkspacesRegular, cluster.AffinityLabelWorkspacesHeadless),
		Tolerations: []corev1.Toleration{
			{
				Key:      "node.kubernetes.io/disk-pressure",
				Operator: "Exists",
				Effect:   "NoExecute",
			},
			{
				Key:      "node.kubernetes.io/memory-pressure",
				Operator: "Exists",
				Effect:   "NoExecute",
			},
			{
				Key:      "node.kubernetes.io/out-of-disk",
				Operator: "Exists",
				Effect:   "NoExecute",
			},
		},
		PriorityClassName:  common.SystemNodeCritical,
		EnableServiceLinks: pointer.Bool(false),
	}

	err = common.AddStorageMounts(ctx, &podSpec, Component)
	if err != nil {
		return nil, err
	}

	if vol, mnt, env, ok := common.CustomCACertVolume(ctx); ok {
		podSpec.Volumes = append(podSpec.Volumes, *vol)
		pod := podSpec.Containers[0]
		pod.VolumeMounts = append(pod.VolumeMounts, *mnt)
		pod.Env = append(pod.Env, env...)
		podSpec.Containers[0] = pod
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
					Labels: labels,
					Annotations: common.CustomizeAnnotation(ctx, Component, common.TypeMetaDaemonset, func() map[string]string {
						return map[string]string{
							"seccomp.security.alpha.kubernetes.io/shiftfs-module-loader": "unconfined",
							common.AnnotationConfigChecksum:                              configHash,
						}
					}),
				},
				Spec: podSpec,
			},
		},
	}}, nil
}
