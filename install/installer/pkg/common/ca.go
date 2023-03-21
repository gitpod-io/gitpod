// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package common

import (
	corev1 "k8s.io/api/core/v1"
)

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
