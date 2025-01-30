// Copyright (c) 2025 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package dockerd

import (
	"bufio"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"io"
	"io/ioutil"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/hashicorp/go-retryablehttp"

	log "github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/image-builder/bob/pkg/proxy"
)

// Loosely based on https://eli.thegreenplace.net/2022/go-and-proxy-servers-part-2-https-proxies/
type MitmProxy struct {
	caCert   *x509.Certificate
	caKey    any
	modifier func(*http.Request) *http.Request

	certCacheMu sync.Mutex
	certCache   map[string]*tls.Certificate
}

// CreateMitmProxy creates a new forwarding proxy that can handle CONNECT request, and intercept their payload. It should be passed the filenames
// for the certificate and private key of a certificate authority trusted by the
// client's machine.
func CreateMitmProxy(caCertFile, caKeyFile string, modifier func(*http.Request) *http.Request) (*MitmProxy, error) {
	caCert, caKey, err := loadX509KeyPair(caCertFile, caKeyFile)
	if err != nil {
		return nil, fmt.Errorf("Error loading CA certificate/key: %w", err)
	}

	return &MitmProxy{
		caCert:    caCert,
		caKey:     caKey,
		modifier:  modifier,
		certCache: make(map[string]*tls.Certificate),
	}, nil
}

func (p *MitmProxy) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodConnect {
		http.Error(w, "this proxy only supports CONNECT", http.StatusMethodNotAllowed)
	}

	p.proxyConnect(w, req)
}

// proxyConnect implements the MITM proxy for CONNECT tunnels.
func (p *MitmProxy) proxyConnect(w http.ResponseWriter, proxyReq *http.Request) {
	log.Debugf("CONNECT requested to %v (from %v)", proxyReq.Host, proxyReq.RemoteAddr)

	// "Hijack" the client connection to get a TCP (or TLS) socket we can read
	// and write arbitrary data to/from.
	hj, ok := w.(http.Hijacker)
	if !ok {
		log.Error("http server doesn't support hijacking connection")
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	clientConn, _, err := hj.Hijack()
	if err != nil {
		log.Error("http hijacking failed")
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	// proxyReq.Host will hold the CONNECT target host, which will typically have
	// a port - e.g. example.org:443
	// To generate a fake certificate for example.org, we have to first split off
	// the host from the port.
	host, _, err := net.SplitHostPort(proxyReq.Host)
	if err != nil {
		log.WithError(err).Error("error splitting host/port")
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	// TODO(gpl): This might not work if the client asks for an IP, which is totally legit.
	// If that ever happens, we can implement DNS discovery as outlined here: https://docs.mitmproxy.org/stable/concepts-howmitmproxyworks/#complication-1-whats-the-remote-hostname
	tlsCert, err := p.getCertOrCreate(host)

	// Send an HTTP OK response back to the client; this initiates the CONNECT
	// tunnel. From this point on the client will assume it's connected directly
	// to the target.
	if _, err := clientConn.Write([]byte("HTTP/1.1 200 OK\r\n\r\n")); err != nil {
		log.WithError(err).Error("error writing status to client")
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	// Configure a new TLS server, pointing it at the client connection, using
	// our certificate. This server will now pretend being the target.
	tlsConfig := &tls.Config{
		PreferServerCipherSuites: true,
		CurvePreferences:         []tls.CurveID{tls.X25519, tls.CurveP256},
		MinVersion:               tls.VersionTLS13,
		Certificates:             []tls.Certificate{*tlsCert},
	}

	tlsConn := tls.Server(clientConn, tlsConfig)
	defer tlsConn.Close()

	// Create a buffered reader for the client connection; this is required to
	// use http package functions with this connection.
	connReader := bufio.NewReader(tlsConn)

	// Run the proxy in a loop until the client closes the connection.
	for {
		// Read an HTTP request from the client; the request is sent over TLS that
		// connReader is configured to serve. The read will run a TLS handshake in
		// the first invocation (we could also call tlsConn.Handshake explicitly
		// before the loop, but this isn't necessary).
		// Note that while the client believes it's talking across an encrypted
		// channel with the target, the proxy gets these requests in "plain text"
		// because of the MITM setup.
		r, err := http.ReadRequest(connReader)
		if err == io.EOF {
			break
		} else if err != nil {
			log.WithError(err).Error("error reading request from client")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		// We can dump the request; log it, modify it...
		// if b, err := httputil.DumpRequest(r, false); err == nil {
		// 	log.Printf("incoming request:\n%s\n", string(b))
		// }

		// Take the original request and changes its destination to be forwarded
		// to the target server.
		err = changeRequestToTarget(r, proxyReq.Host)
		if err != nil {
			log.WithError(err).WithField("targetHost", proxyReq.Host).Error("error parsing target URL")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		// Inject authentication before sending it to the target
		r = p.modifier(r)
		// Also, use our special, retrying Docker client to inject authentication
		client := proxy.CreateAuthenticatingDockerClient()
		targetRequest := &retryablehttp.Request{Request: r}

		// Send the request to the target server and log the response.
		resp, err := client.Do(targetRequest)
		if err != nil {
			log.WithError(err).Error("error sending request to target")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		// if b, err := httputil.DumpResponse(resp, false); err == nil {
		// 	log.Printf("target response:\n%s\n", string(b))
		// }
		defer resp.Body.Close()

		// Send the target server's response back to the client.
		if err := resp.Write(tlsConn); err != nil {
			log.WithError(err).Error("error writing response back")
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
	}
}

func (p *MitmProxy) getCertOrCreate(host string) (*tls.Certificate, error) {
	p.certCacheMu.Lock()
	defer p.certCacheMu.Unlock()

	if cert, ok := p.certCache[host]; ok {
		// Before Go 1.23, cert.Leaf might be nil
		if cert.Leaf == nil {
			var err error
			if cert.Leaf, err = x509.ParseCertificate(cert.Certificate[0]); err != nil {
				return nil, err
			}
		}

		if cert.Leaf.NotAfter.After(time.Now()) {
			return cert, nil
		} else {
			delete(p.certCache, host)
		}
	}

	// Create a fake TLS certificate for the target host, signed by our CA. The
	// certificate will be valid for 10 days - this number can be changed.
	pemCert, pemKey, err := createCert([]string{host}, p.caCert, p.caKey, 240)
	if err != nil {
		return nil, err
	}
	tlsCert, err := tls.X509KeyPair(pemCert, pemKey)
	if err != nil {
		return nil, err
	}
	p.certCache[host] = &tlsCert

	return &tlsCert, nil
}

// changeRequestToTarget modifies req to be re-routed to the given target;
// the target should be taken from the Host of the original tunnel (CONNECT)
// request.
func changeRequestToTarget(req *http.Request, targetHost string) error {
	// TODO(gpl): It feels like we should allow using HTTP as well. But I'm not sure how to establish which protocol
	// the client intends to use, because in the HTTPS requests nothing is explicitly stating HTTPS. Only the 443
	// ports indicates HTTPS - but that signal is not enough to only use HTTPS for that port.
	// For the time being we assume anybody who uses CONNECT wants to use HTTPS.
	if !strings.HasPrefix(targetHost, "https") {
		targetHost = "https://" + targetHost
	}
	targetUrl, err := url.Parse(targetHost)
	if err != nil {
		return err
	}

	targetUrl.Path = req.URL.Path
	targetUrl.RawQuery = req.URL.RawQuery
	req.URL = targetUrl
	// Make sure this is unset for sending the request through a client
	req.RequestURI = ""
	return nil
}

// createCert creates a new certificate/private key pair for the given domains,
// signed by the parent/parentKey certificate. hoursValid is the duration of
// the new certificate's validity.
func createCert(dnsNames []string, parent *x509.Certificate, parentKey crypto.PrivateKey, hoursValid int) (cert []byte, priv []byte, err error) {
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("Failed to generate private key: %v", err)
	}

	serialNumberLimit := new(big.Int).Lsh(big.NewInt(1), 128)
	serialNumber, err := rand.Int(rand.Reader, serialNumberLimit)
	if err != nil {
		return nil, nil, fmt.Errorf("Failed to generate serial number: %v", err)
	}

	template := x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			Organization: []string{"Sample MITM proxy"},
		},
		DNSNames:  dnsNames,
		NotBefore: time.Now(),
		NotAfter:  time.Now().Add(time.Duration(hoursValid) * time.Hour),

		KeyUsage:              x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth, x509.ExtKeyUsageClientAuth},
		BasicConstraintsValid: true,
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, &template, parent, &privateKey.PublicKey, parentKey)
	if err != nil {
		return nil, nil, fmt.Errorf("Failed to create certificate: %v", err)
	}
	pemCert := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: derBytes})
	if pemCert == nil {
		log.Fatal("failed to encode certificate to PEM")
	}

	privBytes, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		return nil, nil, fmt.Errorf("Unable to marshal private key: %v", err)
	}
	pemKey := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privBytes})
	if pemCert == nil {
		return nil, nil, fmt.Errorf("failed to encode key to PEM")
	}

	return pemCert, pemKey, nil
}

// loadX509KeyPair loads a certificate/key pair from files, and unmarshals them
// into data structures from the x509 package. Note that private key types in Go
// don't have a shared named interface and use `any` (for backwards
// compatibility reasons).
func loadX509KeyPair(certFile, keyFile string) (cert *x509.Certificate, key any, err error) {
	cf, err := ioutil.ReadFile(certFile)
	if err != nil {
		return nil, nil, err
	}

	kf, err := ioutil.ReadFile(keyFile)
	if err != nil {
		return nil, nil, err
	}
	certBlock, _ := pem.Decode(cf)
	cert, err = x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return nil, nil, err
	}

	keyBlock, _ := pem.Decode(kf)
	key, err = x509.ParsePKCS8PrivateKey(keyBlock.Bytes)
	if err != nil {
		return nil, nil, err
	}

	return cert, key, nil
}
