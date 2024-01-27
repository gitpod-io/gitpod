// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package auth

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

func keypair(ctx *common.RenderContext) ([]runtime.Object, error) {
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
				Name:      common.AuthPKISecretName,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Spec: certmanagerv1.CertificateSpec{
				Duration: &metav1.Duration{
					Duration: time.Duration(math.MaxInt64), // never expire automatically
				},
				SecretName: common.AuthPKISecretName,
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

func getPKI() ([]corev1.Volume, []corev1.VolumeMount, PKIConfig) {
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

	cfg := PKIConfig{
		Signing: KeyPair{
			ID:             "0001",
			PrivateKeyPath: path.Join(signingDir, "tls.key"),
			PublicKeyPath:  path.Join(signingDir, "tls.crt"),
		},
	}
	return volumes, mounts, cfg
}

type PKIConfig struct {
	// Signing KeyPair is always used to issue new auth tokens
	Signing KeyPair `json:"signing"`

	// Validating KeyPairs are used for checking validity only
	Validating []KeyPair `json:"validating,omitempty"`
}

type KeyPair struct {
	ID             string `json:"id"`
	PrivateKeyPath string `json:"privateKeyPath"`
	PublicKeyPath  string `json:"publicKeyPath"`
}
