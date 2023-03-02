// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package image_builder_mk3_wsman

import (
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	imgbuilder "github.com/gitpod-io/gitpod/installer/pkg/components/image-builder-mk3"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1"

	certmanagerv1 "github.com/jetstack/cert-manager/pkg/apis/certmanager/v1"
	cmmeta "github.com/jetstack/cert-manager/pkg/apis/meta/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func tlssecret(ctx *common.RenderContext) ([]runtime.Object, error) {
	// Only enable TLS in workspace clusters. This check can be removed
	// once image-builder-mk3 has been removed from application clusters
	// (https://github.com/gitpod-io/gitpod/issues/7845).
	if ctx.Config.Kind != config.InstallationWorkspace {
		return nil, nil
	}

	serverAltNames := []string{
		fmt.Sprintf("%s.%s.svc", imgbuilder.Component, ctx.Namespace),
		fmt.Sprintf("%s.%s.svc.cluster.local", imgbuilder.Component, ctx.Namespace),
		imgbuilder.Component,
		fmt.Sprintf("%s-dev", imgbuilder.Component),
	}

	return []runtime.Object{
		&certmanagerv1.Certificate{
			TypeMeta: common.TypeMetaCertificate,
			ObjectMeta: metav1.ObjectMeta{
				Name:      TLSSecretNameWsman,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Spec: certmanagerv1.CertificateSpec{
				Duration:   common.InternalCertDuration,
				SecretName: TLSSecretNameWsman,
				DNSNames:   serverAltNames,
				IssuerRef: cmmeta.ObjectReference{
					Name:  common.CertManagerCAIssuer,
					Kind:  "Issuer",
					Group: "cert-manager.io",
				},
				SecretTemplate: &certmanagerv1.CertificateSecretTemplate{
					Labels: common.DefaultLabels(Component),
				},
			},
		},
	}, nil
}
