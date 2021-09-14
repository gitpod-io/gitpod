package wsmanager

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsdaemon "github.com/gitpod-io/gitpod/installer/pkg/components/ws-daemon"
	"k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	labels := common.DefaultLabels(Component)

	return []runtime.Object{
		&v1.Deployment{
			TypeMeta: common.TypeMetaDeployment,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    labels,
			},
			Spec: v1.DeploymentSpec{
				Selector: &metav1.LabelSelector{
					MatchLabels: map[string]string{
						"Component": Component,
					},
				},
				// todo(sje): receive config value
				Replicas: pointer.Int32(1),
				Strategy: common.DeploymentStrategy,
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Name:      Component,
						Namespace: ctx.Namespace,
						Labels:    labels,
					},
					Spec: corev1.PodSpec{
						PriorityClassName:  "system-node-critical",
						Affinity:           &corev1.Affinity{},
						EnableServiceLinks: pointer.Bool(false),
						ServiceAccountName: Component,
						SecurityContext: &corev1.PodSecurityContext{
							RunAsUser: pointer.Int64(31002),
						},
						Containers: []corev1.Container{{
							Name:            Component,
							Args:            []string{"run", "-v", "--config", "/config/config.json"},
							Image:           common.ImageName(ctx.Config.Repository, Component, ctx.VersionManifest.Components.WSManager.Version),
							ImagePullPolicy: corev1.PullIfNotPresent,
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									"cpu":    resource.MustParse("100m"),
									"memory": resource.MustParse("32Mi"),
								},
							},
							Ports: []corev1.ContainerPort{{
								Name:          "rpc",
								ContainerPort: RPCPort,
							}},
							SecurityContext: &corev1.SecurityContext{
								Privileged: pointer.Bool(false),
							},
							Env: common.MergeEnv(
								common.DefaultEnv(&ctx.Config),
								common.TracingEnv(&ctx.Config),
								[]corev1.EnvVar{{Name: "GRPC_GO_RETRY", Value: "on"}},
							),
							VolumeMounts: []corev1.VolumeMount{{
								Name:      VolumeConfig,
								MountPath: "/config",
								ReadOnly:  true,
							}, {
								Name:      VolumeWorkspaceTemplate,
								MountPath: "/workspace-template",
								ReadOnly:  true,
							}, {
								Name:      wsdaemon.VolumeTLSCerts,
								MountPath: "/ws-daemon-tls-certs",
								ReadOnly:  true,
							}, {
								Name:      VolumeTLSCerts,
								MountPath: "/certs",
								ReadOnly:  true,
							}},
						}},
						Volumes: []corev1.Volume{{
							Name: VolumeConfig,
							VolumeSource: corev1.VolumeSource{
								ConfigMap: &corev1.ConfigMapVolumeSource{
									LocalObjectReference: corev1.LocalObjectReference{Name: Component},
								},
							},
						}, {
							Name: wsdaemon.VolumeTLSCerts,
							VolumeSource: corev1.VolumeSource{
								Secret: &corev1.SecretVolumeSource{
									SecretName: wsdaemon.TLSSecretName,
								},
							},
						}, {
							Name: VolumeTLSCerts,
							VolumeSource: corev1.VolumeSource{
								Secret: &corev1.SecretVolumeSource{
									SecretName: TLSSecretNameSecret,
								},
							},
						}, {
							Name: VolumeWorkspaceTemplate,
							VolumeSource: corev1.VolumeSource{
								ConfigMap: &corev1.ConfigMapVolumeSource{
									LocalObjectReference: corev1.LocalObjectReference{
										Name: "workspace-template",
									}},
							},
						}},
					},
				},
			},
		},
	}, nil
}
