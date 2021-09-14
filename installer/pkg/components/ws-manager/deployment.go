package wsmanager

import (
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	wsdaemon "github.com/gitpod-io/gitpod/installer/pkg/components/ws-daemon"
	"k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/utils/pointer"
)

func deployment(ctx *common.RenderContext) ([]runtime.Object, error) {
	return []runtime.Object{
		&v1.Deployment{
			TypeMeta: common.TypeMetaDeployment,
			ObjectMeta: metav1.ObjectMeta{
				Name:      component,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(component),
			},
			Spec: v1.DeploymentSpec{
				Selector: &metav1.LabelSelector{
					MatchLabels: map[string]string{
						"component": component,
					},
				},
				// todo(sje): receive config value
				Replicas: pointer.Int32(1),
				Strategy: v1.DeploymentStrategy{
					Type: v1.RollingUpdateDeploymentStrategyType,
					RollingUpdate: &v1.RollingUpdateDeployment{
						MaxSurge:       &intstr.IntOrString{IntVal: 1},
						MaxUnavailable: &intstr.IntOrString{IntVal: 0},
					},
				},
				Template: corev1.PodTemplateSpec{
					ObjectMeta: metav1.ObjectMeta{
						Name:      component,
						Namespace: ctx.Namespace,
						Labels:    common.DefaultLabels(component),
					},
					Spec: corev1.PodSpec{
						PriorityClassName: "system-node-critical",
						// todo(sje): add in affinity - this is a Helm definition
						// {{ include "gitpod.pod.affinity" $this | indent 6 }}
						// todo(sje): add in volumes - this is a Helm definition
						// {{- if $comp.volumes }}
						// {{ toYaml $comp.volumes | indent 6 }}
						// {{- end }}
						Affinity:           &corev1.Affinity{},
						EnableServiceLinks: pointer.Bool(false),
						ServiceAccountName: component,
						SecurityContext: &corev1.PodSecurityContext{
							RunAsUser: pointer.Int64(31002),
						},
						Containers: []corev1.Container{{
							Name:            component,
							Args:            []string{"run", "-v", "--config", "/config/config.json"},
							Image:           "", // todo(sje): work out this value
							ImagePullPolicy: corev1.PullIfNotPresent,
							Resources:       corev1.ResourceRequirements{}, // todo(sje): add in details
							Ports:           []corev1.ContainerPort{},      // todo(sje): add in details
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
									LocalObjectReference: corev1.LocalObjectReference{
										Name: "", // todo(sje): work out this value
									},
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
