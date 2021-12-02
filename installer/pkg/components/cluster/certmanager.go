// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cluster

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	v1 "github.com/jetstack/cert-manager/pkg/apis/certmanager/v1"
	cmmeta "github.com/jetstack/cert-manager/pkg/apis/meta/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func certmanager(ctx *common.RenderContext) ([]runtime.Object, error) {
	caIssuer := "gitpod-selfsigned-issuer"
	caName := fmt.Sprintf("%s-ca", common.CertManagerCAIssuer)

	return []runtime.Object{
		// Define a self-signed issuer so we can generate a CA
		&v1.Issuer{
			TypeMeta: common.TypeMetaCertificateIssuer,
			ObjectMeta: metav1.ObjectMeta{
				Name:   caIssuer,
				Labels: common.DefaultLabels(Component, ctx),
			},
			Spec: v1.IssuerSpec{IssuerConfig: v1.IssuerConfig{
				SelfSigned: &v1.SelfSignedIssuer{},
			}},
		},
		// Generate that CA
		&v1.Certificate{
			TypeMeta: common.TypeMetaCertificate,
			ObjectMeta: metav1.ObjectMeta{
				Name:      caName,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component, ctx),
			},
			Spec: v1.CertificateSpec{
				IsCA:       true,
				Duration:   common.InternalCertDuration,
				CommonName: caName,
				SecretName: caName,
				PrivateKey: &v1.CertificatePrivateKey{
					Algorithm: v1.ECDSAKeyAlgorithm,
					Size:      256,
				},
				IssuerRef: cmmeta.ObjectReference{
					Name:  caIssuer,
					Kind:  "Issuer",
					Group: "cert-manager.io",
				},
			},
		},
		// Set the CA to our issuer
		&v1.Issuer{
			TypeMeta: common.TypeMetaCertificateIssuer,
			ObjectMeta: metav1.ObjectMeta{
				Name:      common.CertManagerCAIssuer,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component, ctx),
			},
			Spec: v1.IssuerSpec{IssuerConfig: v1.IssuerConfig{
				CA: &v1.CAIssuer{SecretName: caName},
			}},
		},
	}, nil
}
