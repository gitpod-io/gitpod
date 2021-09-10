// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsdaemon

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1alpha1"
	"github.com/hexops/valast"

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
	labels := common.DefaultLabels(component)

	initContainers := []corev1.Container{
		{
			Name:  "disable-kube-health-monitor",
			Image: "ubuntu:20.04",
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
				ProcMount:  valast.Addr(corev1.ProcMountType("Default")).(*corev1.ProcMountType),
			},
		},
		{
			Name:  "seccomp-profile-installer",
			Image: common.ImageName(cfg.Repository, "seccomp-profile-installer", ctx.VersionManifest.Components.WSDaemon.UserNamespaces.SeccompProfileInstaller.Version),
			Command: []string{
				"/bin/sh",
				"-c",
				"cp -f /installer/workspace_default.json /mnt/dst/workspace_default_not-set.json",
			},
			VolumeMounts: []corev1.VolumeMount{{
				Name:      "hostseccomp",
				MountPath: "/mnt/dst",
			}},
			SecurityContext: &corev1.SecurityContext{Privileged: pointer.Bool(true)},
		},
		{
			Name:  "sysctl",
			Image: common.ImageName(cfg.Repository, "ws-daemon", ctx.VersionManifest.Components.WSDaemon.Version),
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
		initContainers = append(initContainers, corev1.Container{
			Name:  "shiftfs-module-loader",
			Image: common.ImageName(cfg.Repository, "shiftfs-module-loader", ctx.VersionManifest.Components.WSDaemon.UserNamespaces.ShiftFSModuleLoader.Version),
			VolumeMounts: []corev1.VolumeMount{{
				Name:      "node-linux-src",
				ReadOnly:  true,
				MountPath: "/usr/src_node",
			}},
			SecurityContext: &corev1.SecurityContext{Privileged: pointer.Bool(true)},
		})
	}

	return []runtime.Object{&appsv1.DaemonSet{
		TypeMeta: common.TypeMetaDaemonset,
		ObjectMeta: metav1.ObjectMeta{
			Name:      component,
			Namespace: ctx.Namespace,
			Labels:    labels,
		},
		Spec: appsv1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{MatchLabels: labels},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: labels,
					Annotations: map[string]string{
						"seccomp.security.alpha.kubernetes.io/shiftfs-module-loader": "unconfined",
					},
				},
				Spec: corev1.PodSpec{
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
								Path: "/mnt/disks/ssd0/workspaces",
								Type: valast.Addr(corev1.HostPathType("DirectoryOrCreate")).(*corev1.HostPathType),
							}},
						},
						{
							Name:         "tls-certs",
							VolumeSource: corev1.VolumeSource{Secret: &corev1.SecretVolumeSource{SecretName: "ws-daemon-tls"}},
						},
						{
							Name: "config",
							VolumeSource: corev1.VolumeSource{ConfigMap: &corev1.ConfigMapVolumeSource{
								LocalObjectReference: corev1.LocalObjectReference{Name: "ws-daemon-config"},
							}},
						},
						{
							Name: "containerd-socket",
							VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
								Path: "/run/containerd/containerd.sock",
								Type: valast.Addr(corev1.HostPathType("Socket")).(*corev1.HostPathType),
							}},
						},
						{
							Name: "node-fs0",
							VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
								Path: "/var/lib",
								Type: valast.Addr(corev1.HostPathType("Directory")).(*corev1.HostPathType),
							}},
						},
						{
							Name: "node-fs1",
							VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
								Path: "/run/containerd/io.containerd.runtime.v2.task/k8s.io",
								Type: valast.Addr(corev1.HostPathType("Directory")).(*corev1.HostPathType),
							}},
						},
						{
							Name: "node-mounts",
							VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
								Path: "/proc/mounts",
								Type: valast.Addr(corev1.HostPathType("File")).(*corev1.HostPathType),
							}},
						},
						{
							Name: "node-cgroups",
							VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
								Path: "/sys/fs/cgroup",
								Type: valast.Addr(corev1.HostPathType("Directory")).(*corev1.HostPathType),
							}},
						},
						{
							Name: "node-hosts",
							VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
								Path: "/etc/hosts",
								Type: valast.Addr(corev1.HostPathType("File")).(*corev1.HostPathType),
							}},
						},
						{
							Name: "node-linux-src",
							VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
								Path: "/usr/src",
								Type: valast.Addr(corev1.HostPathType("Directory")).(*corev1.HostPathType),
							}},
						},
						{
							Name:         "hostseccomp",
							VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{Path: "/var/lib/kubelet/seccomp"}},
						},
						{
							Name: "gcloud-tmp",
							VolumeSource: corev1.VolumeSource{HostPath: &corev1.HostPathVolumeSource{
								Path: "/mnt/disks/ssd0/sync-tmp",
								Type: valast.Addr(corev1.HostPathType("DirectoryOrCreate")).(*corev1.HostPathType),
							}},
						},
					},
					InitContainers: initContainers,
					Containers: []corev1.Container{
						{
							Name:  component,
							Image: "eu.gcr.io/gitpod-core-dev/build/ws-daemon:not-set",
							Args: []string{
								"run",
								"-v",
								"--config",
								"/config/config.json",
							},
							Ports: []corev1.ContainerPort{{
								Name:          "rpc",
								HostPort:      8080,
								ContainerPort: 8080,
							}},
							Env: common.MergeEnv(
								common.DefaultEnv(&cfg),
								common.TracingEnv(&cfg),
							),
							Resources: corev1.ResourceRequirements{Requests: corev1.ResourceList{
								corev1.ResourceName("cpu"):    resource.MustParse("1m"),
								corev1.ResourceName("memory"): resource.MustParse("1Mi"),
							}},
							VolumeMounts: []corev1.VolumeMount{
								{
									Name:             "working-area",
									MountPath:        "/mnt/workingarea",
									MountPropagation: valast.Addr(corev1.MountPropagationMode("Bidirectional")).(*corev1.MountPropagationMode),
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
									Name:      "node-fs1",
									MountPath: "/mnt/node1",
								},
								{
									Name:             "node-mounts",
									ReadOnly:         true,
									MountPath:        "/mnt/mounts",
									MountPropagation: valast.Addr(corev1.MountPropagationMode("HostToContainer")).(*corev1.MountPropagationMode),
								},
								{
									Name:             "node-cgroups",
									MountPath:        "/mnt/node-cgroups",
									MountPropagation: valast.Addr(corev1.MountPropagationMode("HostToContainer")).(*corev1.MountPropagationMode),
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
							LivenessProbe: &corev1.Probe{
								Handler: corev1.Handler{HTTPGet: &corev1.HTTPGetAction{
									Path: "/",
									Port: intstr.IntOrString{IntVal: 9999},
								}},
								InitialDelaySeconds: 5,
								PeriodSeconds:       10,
								FailureThreshold:    10,
							},
							ReadinessProbe: &corev1.Probe{
								Handler: corev1.Handler{HTTPGet: &corev1.HTTPGetAction{
									Path: "/",
									Port: intstr.IntOrString{IntVal: 9999},
								}},
								InitialDelaySeconds: 5,
								PeriodSeconds:       10,
							},
							ImagePullPolicy: corev1.PullPolicy("Always"),
							SecurityContext: &corev1.SecurityContext{
								Privileged: pointer.Bool(true),
								ProcMount:  valast.Addr(corev1.ProcMountType("Default")).(*corev1.ProcMountType),
							},
						},
						*common.KubeRBACProxyContainer(),
					},
					RestartPolicy:                 corev1.RestartPolicy("Always"),
					TerminationGracePeriodSeconds: pointer.Int64(30),
					DNSPolicy:                     corev1.DNSPolicy("ClusterFirst"),
					ServiceAccountName:            component,
					HostPID:                       true,
					Affinity:                      common.Affinity(common.AffinityLabelWorkspaces, common.AffinityLabelHeadless),
					Tolerations: []corev1.Toleration{
						{
							Key:      "node.kubernetes.io/disk-pressure",
							Operator: corev1.TolerationOperator("Exists"),
							Effect:   corev1.TaintEffect("NoExecute"),
						},
						{
							Key:      "node.kubernetes.io/memory-pressure",
							Operator: corev1.TolerationOperator("Exists"),
							Effect:   corev1.TaintEffect("NoExecute"),
						},
						{
							Key:      "node.kubernetes.io/out-of-disk",
							Operator: corev1.TolerationOperator("Exists"),
							Effect:   corev1.TaintEffect("NoExecute"),
						},
					},
					PriorityClassName:  "system-node-critical",
					EnableServiceLinks: pointer.Bool(false),
				},
			},
		},
	}}, nil
}
