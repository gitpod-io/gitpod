// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package rabbitmq

import (
	"fmt"
	"strings"

	"helm.sh/helm/v3/pkg/cli/values"
	"sigs.k8s.io/yaml"

	"github.com/gitpod-io/gitpod/installer/pkg/cluster"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/gitpod-io/gitpod/installer/third_party/charts"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

var Helm = common.CompositeHelmFunc(
	helm.ImportTemplate(charts.RabbitMQ(), helm.TemplateConfig{}, func(cfg *common.RenderContext) (*common.HelmConfig, error) {
		affinity, err := helm.AffinityYaml(cluster.AffinityLabelMeta)
		if err != nil {
			return nil, err
		}

		affinityTemplate, err := helm.KeyFileValue("rabbitmq.affinity", affinity)
		if err != nil {
			return nil, err
		}

		sharedVolume := "shared-data"

		volumeMounts := []corev1.VolumeMount{
			{
				MountPath: "/gitpod-config",
				Name:      sharedVolume,
			},
		}

		volumeMountsYaml, err := yaml.Marshal(volumeMounts)
		if err != nil {
			return nil, err
		}

		volumeMountsTemplate, err := helm.KeyFileValue("rabbitmq.extraVolumeMounts", volumeMountsYaml)
		if err != nil {
			return nil, err
		}

		volumes := []corev1.Volume{
			{
				Name: sharedVolume,
				VolumeSource: corev1.VolumeSource{
					EmptyDir: &corev1.EmptyDirVolumeSource{},
				},
			},
		}

		volumesYaml, err := yaml.Marshal(volumes)
		if err != nil {
			return nil, err
		}

		volumesTemplate, err := helm.KeyFileValue("rabbitmq.extraVolumes", volumesYaml)
		if err != nil {
			return nil, err
		}

		msgBusPasswordSecret := InClusterMsgBusSecret
		if cfg.Config.MessageBus != nil && cfg.Config.MessageBus.Credentials != nil {
			msgBusPasswordSecret = cfg.Config.MessageBus.Credentials.Name
		}

		loadDefinitionsFile := "/gitpod-config/load_definition.json"

		// Create an init container to convert the password variable to the password value
		// This is so we can use a secret for the custom message bus password in the config
		initContainer := []corev1.Container{
			{
				Name:  "credential-injector",
				Image: cfg.ImageName(common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL), InitContainerImage, InitContainerTag),
				Args: []string{
					"sh",
					"-c",
					fmt.Sprintf(`sed "s/%s/${PASSWORD}/" /app/load_definition.json > %s`, passwordReplaceString, loadDefinitionsFile),
				},
				Env: []corev1.EnvVar{
					{
						Name: "PASSWORD",
						ValueFrom: &corev1.EnvVarSource{
							SecretKeyRef: &corev1.SecretKeySelector{
								LocalObjectReference: corev1.LocalObjectReference{
									Name: msgBusPasswordSecret,
								},
								Key: "rabbitmq-password",
							},
						},
					},
				},
				VolumeMounts: append(
					[]corev1.VolumeMount{
						// Mount the load definition
						{
							MountPath: "/app",
							Name:      "load-definition-volume", // Set by Helm chart
						},
					},
					volumeMounts...,
				),
			},
		}

		initContainerYaml, err := yaml.Marshal(initContainer)
		if err != nil {
			return nil, err
		}

		initContainerTemplate, err := helm.KeyFileValue("rabbitmq.initContainers", initContainerYaml)
		if err != nil {
			return nil, err
		}

		imageRegistry := common.ThirdPartyContainerRepo(cfg.Config.Repository, common.DockerRegistryURL)

		// Add pod annotation in case config/secrets change
		var hashObj []runtime.Object
		if objs, err := configuration(cfg); err != nil {
			return nil, err
		} else {
			hashObj = append(hashObj, objs...)
		}
		if objs, err := secrets(cfg); err != nil {
			return nil, err
		} else {
			hashObj = append(hashObj, objs...)
		}

		podAnnotations, err := common.ObjectHash(hashObj, nil)
		if err != nil {
			return nil, err
		}

		return &common.HelmConfig{
			Enabled: true,
			Values: &values.Options{
				Values: []string{
					helm.KeyValue("rabbitmq.auth.username", rabbitMQUsername),
					helm.KeyValue("rabbitmq.auth.existingPasswordSecret", msgBusPasswordSecret),
					helm.KeyValue("rabbitmq.auth.existingErlangSecret", CookieSecret),
					helm.KeyValue("rabbitmq.auth.tls.existingSecret", TLSSecret),
					helm.KeyValue("rabbitmq.serviceAccount.name", Component),
					helm.ImagePullSecrets("rabbitmq.image.pullSecrets", cfg),
					helm.KeyValue("rabbitmq.image.registry", imageRegistry),
					helm.ImagePullSecrets("volumePermissions.image.pullSecrets", cfg),
					helm.KeyValue("rabbitmq.volumePermissions.image.registry", imageRegistry),
					helm.KeyValue("rabbitmq.loadDefinition.file", loadDefinitionsFile),
					helm.KeyValue(fmt.Sprintf("rabbitmq.podAnnotations.%s", strings.Replace(common.AnnotationConfigChecksum, ".", "\\.", -1)), podAnnotations),

					helm.KeyValue("rabbitmq.livenessProbe.initialDelaySeconds", "30"),
				},
				// This is too complex to be sent as a string
				FileValues: []string{
					affinityTemplate,
					initContainerTemplate,
					volumeMountsTemplate,
					volumesTemplate,
				},
			},
		}, nil
	}),
)
