// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package public_api_server

import (
	"path"

	"github.com/gitpod-io/gitpod/components/public-api/go/config"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
)

func getAuthPKI() ([]corev1.Volume, []corev1.VolumeMount, config.AuthPKIConfiguration) {

	dir := "/secrets/auth-pki"
	signingDir := path.Join(dir, "signing")

	volumes := []corev1.Volume{
		{
			Name: "auth-pki-signing",
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: common.AuthPKISecretName,
				},
			},
		},
	}

	mounts := []corev1.VolumeMount{
		{
			Name:      "auth-pki-signing",
			MountPath: signingDir,
			ReadOnly:  true,
		},
	}

	cfg := config.AuthPKIConfiguration{
		Signing: config.KeyPair{
			PrivateKeyPath: path.Join(signingDir, "tls.key"),
			PublicKeyPath:  path.Join(signingDir, "tls.crt"),
		},
	}
	return volumes, mounts, cfg
}
