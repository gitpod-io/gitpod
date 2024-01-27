// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package usage

import (
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	corev1 "k8s.io/api/core/v1"
	"path/filepath"
)

func getStripeConfig(cfg *experimental.Config) (corev1.Volume, corev1.VolumeMount, string, bool) {
	var volume corev1.Volume
	var mount corev1.VolumeMount
	var path string

	if cfg == nil || cfg.WebApp == nil || cfg.WebApp.Server == nil || cfg.WebApp.Server.StripeSecret == "" {
		return volume, mount, path, false
	}

	stripeSecret := cfg.WebApp.Server.StripeSecret

	volume = corev1.Volume{
		Name: "stripe-secret",
		VolumeSource: corev1.VolumeSource{
			Secret: &corev1.SecretVolumeSource{
				SecretName: stripeSecret,
			},
		},
	}

	mount = corev1.VolumeMount{
		Name:      "stripe-secret",
		MountPath: stripeSecretMountPath,
		ReadOnly:  true,
	}

	path = filepath.Join(stripeSecretMountPath, stripeKeyFilename)

	return volume, mount, path, true
}
