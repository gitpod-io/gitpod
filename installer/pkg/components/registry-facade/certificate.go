// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registryfacade

import (
	"fmt"
	"time"

	certmanagerv1 "github.com/jetstack/cert-manager/pkg/apis/certmanager/v1"
	cmmeta "github.com/jetstack/cert-manager/pkg/apis/meta/v1"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func certificate(ctx *common.RenderContext) ([]runtime.Object, error) {
	oneYear := &metav1.Duration{Duration: time.Hour * 24 * 365}

	return []runtime.Object{&certmanagerv1.Certificate{
		TypeMeta: common.TypeMetaCertificate,
		ObjectMeta: metav1.ObjectMeta{
			Name:      common.RegistryFacadeTLSCertSecret,
			Namespace: ctx.Namespace,
			Labels:    common.DefaultLabels(Component),
		},
		Spec: certmanagerv1.CertificateSpec{
			Duration:   oneYear,
			SecretName: common.RegistryFacadeTLSCertSecret,
			IssuerRef: cmmeta.ObjectReference{
				Name:  common.CertManagerCAIssuer,
				Kind:  "Issuer",
				Group: "cert-manager.io",
			},
			DNSNames: []string{
				fmt.Sprintf("reg.%s", ctx.Config.Domain),
			},
		},
	}}, nil
}
