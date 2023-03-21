// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import (
	corev1 "k8s.io/api/core/v1"
)

func CAVolume() corev1.Volume {
	return corev1.Volume{
		Name: "ca-certificates",
		VolumeSource: corev1.VolumeSource{
			ConfigMap: &corev1.ConfigMapVolumeSource{
				LocalObjectReference: corev1.LocalObjectReference{Name: "gitpod-ca-bundle"},
			},
		},
	}
}

func CAVolumeMount() corev1.VolumeMount {
	return corev1.VolumeMount{
		Name:      "ca-certificates",
		MountPath: "/etc/ssl/certs/ca-certificates.crt",
		SubPath:   "ca-certificates.crt",
		ReadOnly:  true,
	}
}
