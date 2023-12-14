// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package image_builder_mk3

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"

	certmanagerv1 "github.com/jetstack/cert-manager/pkg/apis/certmanager/v1"
	cmmeta "github.com/jetstack/cert-manager/pkg/apis/meta/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func tlssecret(ctx *common.RenderContext) ([]runtime.Object, error) {
	serverAltNames := []string{
		fmt.Sprintf("%s.%s.svc", Component, ctx.Namespace),
		fmt.Sprintf("%s.%s.svc.cluster.local", Component, ctx.Namespace),
		Component,
		fmt.Sprintf("%s-dev", Component),
	}

	return []runtime.Object{
		&certmanagerv1.Certificate{
			TypeMeta: common.TypeMetaCertificate,
			ObjectMeta: metav1.ObjectMeta{
				Name:      TLSSecretName,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Spec: certmanagerv1.CertificateSpec{
				Duration:   common.InternalCertDuration,
				SecretName: TLSSecretName,
				DNSNames:   serverAltNames,
				IssuerRef: cmmeta.ObjectReference{
					Name:  common.CertManagerCAIssuer,
					Kind:  certmanagerv1.ClusterIssuerKind,
					Group: "cert-manager.io",
				},
				SecretTemplate: &certmanagerv1.CertificateSecretTemplate{
					Labels: common.DefaultLabels(Component),
				},
			},
		},
	}, nil
}
