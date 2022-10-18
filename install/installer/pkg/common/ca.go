// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import (
	corev1 "k8s.io/api/core/v1"
)

const (
	cacerts      = "cacerts"
	caVolumeName = "gitpod-ca-certificate"
)

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
func InternalCAContainer(ctx *RenderContext, mod ...func(*corev1.Container)) *corev1.Container {
	res := &corev1.Container{
		Name: "update-ca-certificates",
		// It's not possible to use images based on alpine due to errors running update-ca-certificates
		Image:           ctx.ImageName(ctx.Config.Repository, "ca-updater", ctx.VersionManifest.Components.CAUpdater.Version),
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
		Env: ProxyEnv(&ctx.Config),
	}

	for _, m := range mod {
		m(res)
	}

	return res
}

// CustomCACertVolume produces the objects required to mount custom CA certificates
func CustomCACertVolume(ctx *RenderContext) (vol *corev1.Volume, mnt *corev1.VolumeMount, env []corev1.EnvVar, ok bool) {
	if ctx.Config.CustomCACert == nil {
		return nil, nil, nil, false
	}

	const (
		volumeName        = "custom-ca-cert"
		customCAMountPath = "/etc/ssl/certs/custom-ca.crt"
		certsMountPath    = "/etc/ssl/certs/"
	)
	vol = &corev1.Volume{
		Name: volumeName,
		VolumeSource: corev1.VolumeSource{
			Secret: &corev1.SecretVolumeSource{
				SecretName: ctx.Config.CustomCACert.Name,
				Items: []corev1.KeyToPath{
					{
						Key:  "ca.crt",
						Path: "ca.crt",
					},
				},
			},
		},
	}
	mnt = &corev1.VolumeMount{
		Name:      volumeName,
		ReadOnly:  true,
		MountPath: customCAMountPath,
		SubPath:   "ca.crt",
	}
	env = MergeEnv(
		[]corev1.EnvVar{
			{Name: "NODE_EXTRA_CA_CERTS", Value: customCAMountPath},
			{Name: "GIT_SSL_CAPATH", Value: certsMountPath},
			{Name: "GIT_SSL_CAINFO", Value: customCAMountPath},
		},
		ProxyEnv(&ctx.Config),
	)
	ok = true
	return
}
