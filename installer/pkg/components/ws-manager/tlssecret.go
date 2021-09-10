package wsmanager

import (
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	certmanagerv1 "github.com/jetstack/cert-manager/pkg/apis/certmanager/v1"
	cmmeta "github.com/jetstack/cert-manager/pkg/apis/meta/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func tlssecret(ctx *common.RenderContext) ([]runtime.Object, error) {
	gitpodFullname := "gitpod"

	serverAltNames := []string{
		fmt.Sprintf("%s.%s", gitpodFullname, ctx.Namespace),
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

	caCert, x509CaCert, err := common.GenerateCA("wsmanager-caCert", 365)
	if err != nil {
		return nil, err
	}

	cert, err := common.GenerateSignedCert(gitpodFullname, serverAltNames, 365, x509CaCert)
	if err != nil {
		return nil, err
	}

	clientCert, err := common.GenerateSignedCert(gitpodFullname, clientAltNames, 365, x509CaCert)
	if err != nil {
		return nil, err
	}

	serverSecretName := "ws-manager-tls"
	clientSecretName := "ws-manager-client-tls"

	// todo(sje): inject config and make conditional
	return []runtime.Object{
		&certmanagerv1.Certificate{
			TypeMeta: common.TypeMetaCertificate,
			ObjectMeta: metav1.ObjectMeta{
				Name:      component,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(component),
			},
			Spec: certmanagerv1.CertificateSpec{
				SecretName: serverSecretName,
				DNSNames:   serverAltNames,
				IssuerRef: cmmeta.ObjectReference{
					Name:  "caCert-issuer",
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
				SecretName: clientSecretName,
				DNSNames:   clientAltNames,
				IssuerRef: cmmeta.ObjectReference{
					Name:  "caCert-issuer",
					Kind:  "Issuer",
					Group: "cert-manager.io",
				},
			},
		},
		&v1.Secret{
			TypeMeta: common.TypeMetaSecret,
			ObjectMeta: metav1.ObjectMeta{
				Name:      serverSecretName,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(component),
			},
			Data: map[string][]byte{
				"caCert.crt": []byte(caCert.Cert.String()),
				"tls.crt":    []byte(cert.Cert.String()),
				"tls.key":    []byte(cert.Key.String()),
			},
		},
		&v1.Secret{
			TypeMeta: common.TypeMetaSecret,
			ObjectMeta: metav1.ObjectMeta{
				Name:      clientSecretName,
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(component),
			},
			Data: map[string][]byte{
				"caCert.crt": []byte(caCert.Cert.String()),
				"tls.crt":    []byte(clientCert.Cert.String()),
				"tls.key":    []byte(clientCert.Key.String()),
			},
		},
	}, nil
}
