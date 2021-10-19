// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package wsmanager

import (
	"fmt"
	"time"

	"github.com/gitpod-io/gitpod/installer/pkg/common"

	certmanagerv1 "github.com/jetstack/cert-manager/pkg/apis/certmanager/v1"
	cmmeta "github.com/jetstack/cert-manager/pkg/apis/meta/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func tlssecret(ctx *common.RenderContext) ([]runtime.Object, error) {
	serverAltNames := []string{
		fmt.Sprintf("gitpod.%s", ctx.Namespace),
		fmt.Sprintf("%s.ws-manager.svc", ctx.Namespace),
		"ws-manager",
		"ws-manager-dev",
	}
	clientAltNames := []string{
		"registry-facade",
		"server",
		"ws-manager-bridge",
		"ws-scheduler",
		"ws-proxy",
		"ws-manager",
	}

	sixMonths := &metav1.Duration{Duration: time.Hour * 4380}
	issuer := common.CertManagerCAIssuer

	return []runtime.Object{
		&certmanagerv1.Certificate{
			TypeMeta: common.TypeMetaCertificate,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Spec: certmanagerv1.CertificateSpec{
				Duration:   sixMonths,
				SecretName: TLSSecretNameSecret,
				DNSNames:   serverAltNames,
				IssuerRef: cmmeta.ObjectReference{
					Name:  issuer,
					Kind:  "ClusterIssuer",
					Group: "cert-manager.io",
				},
			},
		},
		&certmanagerv1.Certificate{
			TypeMeta: common.TypeMetaCertificate,
			ObjectMeta: metav1.ObjectMeta{
				Name:      Component,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component),
			},
			Spec: certmanagerv1.CertificateSpec{
				Duration:   sixMonths,
				SecretName: TLSSecretNameClient,
				DNSNames:   clientAltNames,
				IssuerRef: cmmeta.ObjectReference{
					Name:  issuer,
					Kind:  "ClusterIssuer",
					Group: "cert-manager.io",
				},
			},
		},
	}, nil
}
