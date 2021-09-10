package common

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"time"
)

// X509CACert todo(sje): I'm not sure I like this name
type X509CACert struct {
	Cert *x509.Certificate
	PrivateKey *rsa.PrivateKey
}

type Certificate struct {
	Cert *bytes.Buffer
	Key  *bytes.Buffer
}

func GenerateCA(name string, daysValid int) (*Certificate, *X509CACert, error) {
	caPrivateKey, err := generateRSAKey()
	if err != nil {
		return nil, nil, err
	}

	ca := &x509.Certificate{
		SerialNumber: big.NewInt(2019),
		Subject: pkix.Name{
			CommonName: name,
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(time.Hour * 24 * time.Duration(daysValid)),
		IsCA:                  true,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		BasicConstraintsValid: true,
	}

	caBytes, err := x509.CreateCertificate(rand.Reader, ca, ca, &caPrivateKey.PublicKey, caPrivateKey)
	if err != nil {
		return  nil, nil, err
	}

	// pem encode
	caPEM := new(bytes.Buffer)
	if err = pem.Encode(
		caPEM,
		&pem.Block{Type: "CERTIFICATE", Bytes: caBytes},
	); err != nil {
		return nil, nil, err
	}

	caPrivateKeyPEM := new(bytes.Buffer)
	if err = pem.Encode(
		caPrivateKeyPEM,
		&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(caPrivateKey)},
	); err != nil {
		return nil, nil, err
	}

	cert := &Certificate{
		Cert: caPEM,
		Key: caPrivateKeyPEM,
	}

	caCert := &X509CACert{
		Cert: ca,
		PrivateKey: caPrivateKey,
	}

	return cert, caCert, nil
}

func GenerateSignedCert(name string, dnsNames []string, daysValid int, ca *X509CACert) (Certificate, error) {
	cert := Certificate{}

	certPrivKey, err := generateRSAKey()
	if err != nil {
		return cert, err
	}

	// set up our server certificate
	template := &x509.Certificate{
		SerialNumber: big.NewInt(2019),
		Subject: pkix.Name{
			CommonName: name,
		},
		DNSNames:     dnsNames,
		NotBefore:    time.Now(),
		NotAfter:     time.Now().Add(time.Hour * 24 * time.Duration(daysValid)),
		SubjectKeyId: []byte{1, 2, 3, 4, 6},
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
		KeyUsage:     x509.KeyUsageDigitalSignature,
	}

	certBytes, err := x509.CreateCertificate(rand.Reader, template, ca.Cert, &certPrivKey.PublicKey, ca.PrivateKey)
	if err != nil {
		return cert, err
	}

	certPEM := new(bytes.Buffer)
	if err = pem.Encode(
		certPEM,
		&pem.Block{
			Type:  "CERTIFICATE",
			Bytes: certBytes,
		}); err != nil {
		return cert, err
	}

	certPrivateKeyPEM := new(bytes.Buffer)
	if err = pem.Encode(
		certPrivateKeyPEM,
		&pem.Block{
			Type:  "RSA PRIVATE KEY",
			Bytes: x509.MarshalPKCS1PrivateKey(certPrivKey),
		}); err != nil {
		return cert, err
	}

	cert.Cert = certPEM
	cert.Key = certPrivateKeyPEM

	return cert, nil
}

func generateRSAKey() (*rsa.PrivateKey, error) {
	return rsa.GenerateKey(rand.Reader, 4096)
}
