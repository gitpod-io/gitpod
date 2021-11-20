// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package common

import (
	corev1 "k8s.io/api/core/v1"
)

const (
	cacerts      = "cacerts"
	etcSSLCerts  = "/etc/ssl/certs"
	caVolumeName = "gitpod-ca-certificate"
)

func InternalCAVolumeMount() *corev1.VolumeMount {
	return &corev1.VolumeMount{
		Name:      cacerts,
		ReadOnly:  true,
		MountPath: etcSSLCerts,
	}
}

func InternalCAVolume() *corev1.Volume {
	return &corev1.Volume{
		Name: caVolumeName,
		VolumeSource: corev1.VolumeSource{
			EmptyDir: &corev1.EmptyDirVolumeSource{},
		},
	}
}

// InternalCAContainer returns a container that updates the CA certificates
// adding the internal Gitpod self-generated CA.
// This is required for components that communicate with registry-facade
// and cannot use certificates signed by unknown authority, like containerd or buildkit
func InternalCAContainer(ctx *RenderContext, component, version string) *corev1.Container {
	return &corev1.Container{
		Name: "update-ca-certificates",
		// It's not possible to use images based on alpine due to errors running update-ca-certificates
		Image:           ImageName("ghcr.io/gitpod-io", "gitpod-ca-updater", "latest"),
		ImagePullPolicy: corev1.PullIfNotPresent,
		Command: []string{
			"bash", "-c",
			"set -e; update-ca-certificates -f; cp /etc/ssl/certs/* /ssl-certs; echo 'OK'",
		},
		VolumeMounts: []corev1.VolumeMount{
			{
				Name:      cacerts,
				MountPath: "/ssl-certs",
			},
			{
				Name:      caVolumeName,
				SubPath:   "ca.crt",
				MountPath: "/usr/local/share/ca-certificates/gitpod-ca.crt",
			},
		},
	}
}
