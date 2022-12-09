// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package iam

import (
	"path/filepath"

	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/utils/pointer"
)

func getOIDCClientsConfig(cfg *experimental.Config) (corev1.Volume, corev1.VolumeMount, string, bool) {
	var volume corev1.Volume
	var mount corev1.VolumeMount
	var path string

	if cfg == nil || cfg.WebApp == nil || cfg.WebApp.IAM == nil || cfg.WebApp.IAM.OIDCClientsSecretName == "" {
		return volume, mount, path, false
	}

	secretName := cfg.WebApp.IAM.OIDCClientsSecretName

	volume = corev1.Volume{
		Name: "oidc-clients-secret",
		VolumeSource: corev1.VolumeSource{
			Secret: &corev1.SecretVolumeSource{
				SecretName: secretName,
				Optional:   pointer.Bool(true),
			},
		},
	}

	mount = corev1.VolumeMount{
		Name:      "oidc-clients-secret",
		MountPath: oidcClientsSecretMountPath,
		ReadOnly:  true,
	}
	path = filepath.Join(oidcClientsSecretMountPath, oidcClientsSecretFilename)

	return volume, mount, path, true
}
