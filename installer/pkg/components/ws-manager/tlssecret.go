package wsmanager

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	certmanagerv1 "github.com/jetstack/cert-manager/pkg/apis/certmanager/v1"
	cmmeta "github.com/jetstack/cert-manager/pkg/apis/meta/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"time"
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

	serverSecretName := "ws-manager-tls"
	clientSecretName := "ws-manager-client-tls"
	sixMonths := &metav1.Duration{Duration: time.Hour * 4380}
	issuer := "ca-issuer"

	return []runtime.Object{
		&certmanagerv1.Certificate{
			TypeMeta: common.TypeMetaCertificate,
			ObjectMeta: metav1.ObjectMeta{
				Name:      component,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(component),
			},
			Spec: certmanagerv1.CertificateSpec{
				Duration:   sixMonths,
				SecretName: serverSecretName,
				DNSNames:   serverAltNames,
				IssuerRef: cmmeta.ObjectReference{
					Name:  issuer,
					Kind:  "Issuer",
					Group: "cert-manager.io",
				},
			},
		},
		&certmanagerv1.Certificate{
			TypeMeta: common.TypeMetaCertificate,
			ObjectMeta: metav1.ObjectMeta{
				Name:      component,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(component),
			},
			Spec: certmanagerv1.CertificateSpec{
				Duration:   sixMonths,
				SecretName: clientSecretName,
				DNSNames:   clientAltNames,
				IssuerRef: cmmeta.ObjectReference{
					Name:  issuer,
					Kind:  "Issuer",
					Group: "cert-manager.io",
				},
			},
		},
	}, nil
}
