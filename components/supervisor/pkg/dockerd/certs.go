// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dockerd

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"io"
	"math/big"
	"net"
	"os"
	"path"
	"time"

	log "github.com/gitpod-io/gitpod/common-go/log"
)

func EnsureProxyCaAndCertificatesInstalled(certDir string) (certPath string, keyPath string, err error) {
	// Generate certificates if they are not present, yet
	if err := os.MkdirAll(certDir, 0755); err != nil {
		return "", "", fmt.Errorf("failed to create cert directory: %w", err)
	}

	// Create certificates and CA if they don't already exist
	caPath := path.Join(certDir, "dockerd-proxy.pem")
	certPath = path.Join(certDir, "proxy.crt")
	keyPath = path.Join(certDir, "proxy.key")
	_, statErr := os.Stat(certPath)
	if statErr != nil {
		if !os.IsNotExist(statErr) {
			return "", "", fmt.Errorf("unexpected error while checking for certificate file: %w", statErr)
		}

		if err := generateCAAndCerts(caPath, certPath, keyPath); err != nil {
			return "", "", fmt.Errorf("failed to generate and save certificates: %w", err)
		}
	}

	// Install CA if not already installed
	caInstallPath := "/etc/ssl/certs/dockerd-proxy.pem"
	caBundleInstallPath := "/etc/ssl/certs/ca-certificates.crt"
	_, statErr = os.Stat(caInstallPath)
	if statErr == nil {
		log.Infof("CA certificate already installed at %s, skipping install.", caInstallPath)
		return certPath, keyPath, nil
	}
	if !os.IsNotExist(statErr) {
		return "", "", fmt.Errorf("unexpected error while checking for installed CA file: %w", statErr)
	}

	inFile, err := os.Open(caPath)
	if err != nil {
		return "", "", fmt.Errorf("cannot read CA file: %w", err)
	}
	defer inFile.Close()
	buf, err := io.ReadAll(inFile)
	if err != nil {
		return "", "", fmt.Errorf("error reading certificat from file: %w", err)
	}

	// Append CA to bundle
	bundleFile, err := os.OpenFile(caBundleInstallPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return "", "", fmt.Errorf("cannot open CA bundle file: %w", err)
	}
	defer func() {
		cerr := bundleFile.Close()
		if err == nil {
			err = cerr
		}
	}()
	if _, err = io.Copy(bundleFile, bytes.NewReader(buf)); err != nil {
		return "", "", fmt.Errorf("cannot append to CA bundle file: %w", err)
	}
	if err = bundleFile.Sync(); err != nil {
		return "", "", fmt.Errorf("cannot syncing CA bundle file: %w", err)
	}
	log.Infof("installed CA certificate to bundle at %s", caBundleInstallPath)

	// Install CA in own file
	caFile, err := os.Create(caInstallPath)
	if err != nil {
		return "", "", fmt.Errorf("cannot create CA install file: %w", err)
	}
	defer func() {
		cerr := caFile.Close()
		if err == nil {
			err = cerr
		}
	}()
	if _, err = io.Copy(caFile, bytes.NewReader(buf)); err != nil {
		return "", "", fmt.Errorf("cannot write CA install file: %w", err)
	}
	if err = caFile.Sync(); err != nil {
		return "", "", fmt.Errorf("cannot syncing CA install file: %w", err)
	}
	log.Infof("installed CA certificate at %s", caInstallPath)

	return certPath, keyPath, err
}

// generateCAAndCerts generates a CA and a TLS certificate and saves them to the given paths
// As these are a) temporary for the lifetime for the workspace and b) only used inside the workspace to enable
// communication between dockerd and the dockerd-proxy, they don't need to be valid for long, nor do they need to be secure.
func generateCAAndCerts(caPath, crtPath, keyPath string) error {
	// Generate TLS certificate
	certPEM, keyPEM, err := generateSelfSignedTLSCertAndKey()
	if err != nil {
		return fmt.Errorf("failed to generate TLS certificate: %w", err)
	}

	// Write certificate and key to files
	if err := os.WriteFile(crtPath, certPEM, 0777); err != nil {
		return fmt.Errorf("failed to write certificate file: %w", err)
	}

	if err := os.WriteFile(keyPath, keyPEM, 0600); err != nil {
		return fmt.Errorf("failed to write key file: %w", err)
	}

	// Write ca to file
	if err := os.WriteFile(caPath, certPEM, 0777); err != nil {
		return fmt.Errorf("failed to write ca file: %w", err)
	}

	return nil
}

func generateSelfSignedTLSCertAndKey() (certPEM, keyPEM []byte, err error) {
	_, privKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate TLS private key: %w", err)
	}
	// ECDSA, ED25519 and RSA subject keys should have the DigitalSignature
	// KeyUsage bits set in the x509.Certificate template
	keyUsage := x509.KeyUsageDigitalSignature
	notBefore := time.Now()
	notAfter := notBefore.AddDate(10, 0, 0)

	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			Organization: []string{"Gitpod"},
		},
		NotBefore:             notBefore,
		NotAfter:              notAfter,
		KeyUsage:              keyUsage,
		IPAddresses:           []net.IP{net.IPv4(127, 0, 0, 1)},
		DNSNames:              []string{"localhost"},
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}

	//self-signed
	template.IsCA = true
	template.KeyUsage |= x509.KeyUsageCertSign

	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, privKey.Public(), privKey)
	if err != nil {
		return nil, nil, fmt.Errorf("Failed to create certificate: %w", err)
	}

	// Encode certificate and private key to PEM
	certPEM = pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: derBytes,
	})

	privBytes, err := x509.MarshalPKCS8PrivateKey(privKey)
	if err != nil {
		return nil, nil, fmt.Errorf("Unable to marshal private key: %w", err)
	}
	keyPEM = pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: privBytes,
	})

	return certPEM, keyPEM, nil
}
