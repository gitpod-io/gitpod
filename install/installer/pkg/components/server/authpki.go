// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"fmt"
	"math"
	"path"
	"time"

	"github.com/gitpod-io/gitpod/installer/pkg/common"

	certmanagerv1 "github.com/jetstack/cert-manager/pkg/apis/certmanager/v1"
	cmmeta "github.com/jetstack/cert-manager/pkg/apis/meta/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func authPKI(ctx *common.RenderContext) ([]runtime.Object, error) {
	serverAltNames := []string{
		fmt.Sprintf("gitpod.%s", ctx.Namespace),
		fmt.Sprintf("%s.%s.svc", Component, ctx.Namespace),
		Component,
		fmt.Sprintf("%s-dev", Component),
	}

	return []runtime.Object{
		&certmanagerv1.Certificate{
			TypeMeta: common.TypeMetaCertificate,
			ObjectMeta: metav1.ObjectMeta{
				Name:      AuthPKISecretName,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Spec: certmanagerv1.CertificateSpec{
				Duration: &metav1.Duration{
					Duration: time.Duration(math.MaxInt64), // never expire automatically
				},
				SecretName: AuthPKISecretName,
				DNSNames:   serverAltNames,
				IssuerRef: cmmeta.ObjectReference{
					Name:  common.CertManagerCAIssuer,
					Kind:  certmanagerv1.ClusterIssuerKind,
					Group: "cert-manager.io",
				},
				PrivateKey: &certmanagerv1.CertificatePrivateKey{
					Encoding:  certmanagerv1.PKCS8,
					Size:      4096,
					Algorithm: certmanagerv1.RSAKeyAlgorithm,
				},
				SecretTemplate: &certmanagerv1.CertificateSecretTemplate{
					Labels: common.DefaultLabels(Component),
				},
			},
		},
	}, nil
}

func getAuthPKI() ([]corev1.Volume, []corev1.VolumeMount, AuthPKIConfig) {

	dir := "/secrets/auth-pki"
	signingDir := path.Join(dir, "signing")

	volumes := []corev1.Volume{
		{
			Name: "auth-pki-signing",
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName: AuthPKISecretName,
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

	cfg := AuthPKIConfig{
		Signing: KeyPair{
			PrivateKeyPath: path.Join(signingDir, "tls.key"),
			PublicKeyPath:  path.Join(signingDir, "tls.crt"),
		},
	}
	return volumes, mounts, cfg
}
