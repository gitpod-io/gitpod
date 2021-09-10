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
	gitpodFullname := "gitpod" // @todo(sje) do we need to replace "gitpod" with a fullNameOverride?

	ca, err := common.GenerateCA("wsmanager-ca", 365)
	if err != nil {
		return nil, err
	}

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

	cert, err := common.GenerateSignedCert(gitpodFullname, nil, serverAltNames, 365, ca)
	if err != nil {
		return nil, err
	}

	clientCert, err := common.GenerateSignedCert(gitpodFullname, nil, clientAltNames, 365, ca)
	if err != nil {
		return nil, err
	}

	serverSecretName := "ws-manager-tls"
	clientSecretName := "ws-manager-client-tls"

	// @todo(sje) inject config and make conditional
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
					Name:  "ca-issuer",
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
					Name:  "ca-issuer",
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
				"ca.crt":  []byte(ca.Cert),
				"tls.crt": []byte(cert.Cert),
				"tls.key": []byte(cert.Key),
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
				"ca.crt":  []byte(ca.Cert),
				"tls.crt": []byte(clientCert.Cert),
				"tls.key": []byte(clientCert.Key),
			},
		},
	}, nil
}
