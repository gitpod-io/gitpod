// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"crypto/tls"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gitpod-io/golang-crypto/ssh"
	"github.com/gorilla/mux"
	"github.com/klauspost/cpuid/v2"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// WorkspaceProxy is the entity which forwards all inbound requests to the relevant workspace pods.
type WorkspaceProxy struct {
	Ingress               HostBasedIngressConfig
	Config                Config
	WorkspaceRouter       WorkspaceRouter
	WorkspaceInfoProvider WorkspaceInfoProvider
	SSHHostSigners        []ssh.Signer
}

// NewWorkspaceProxy creates a new workspace proxy.
func NewWorkspaceProxy(ingress HostBasedIngressConfig, config Config, workspaceRouter WorkspaceRouter, workspaceInfoProvider WorkspaceInfoProvider, signers []ssh.Signer) *WorkspaceProxy {
	return &WorkspaceProxy{
		Ingress:               ingress,
		Config:                config,
		WorkspaceRouter:       workspaceRouter,
		WorkspaceInfoProvider: workspaceInfoProvider,
		SSHHostSigners:        signers,
	}
}

func redirectToHTTPS(w http.ResponseWriter, r *http.Request) {
	target := "https://" + r.Host + r.URL.Path
	if len(r.URL.RawQuery) > 0 {
		target += "?" + r.URL.RawQuery
	}
	log.WithField("target", target).Debug("redirect to https")
	http.Redirect(w, r, target, http.StatusTemporaryRedirect)
}

// MustServe starts the proxy and ends the process if doing so fails.
func (p *WorkspaceProxy) MustServe() {
	handler, err := p.Handler()
	if err != nil {
		log.WithError(err).Fatal("cannot initialize proxy - this is likely a configuration issue")
		return
	}
	srv := &http.Server{
		Addr:    p.Ingress.HTTPSAddress,
		Handler: handler,
		TLSConfig: &tls.Config{
			CipherSuites:             optimalDefaultCipherSuites(),
			CurvePreferences:         []tls.CurveID{tls.CurveP521, tls.CurveP384, tls.CurveP256},
			MinVersion:               tls.VersionTLS12,
			MaxVersion:               tls.VersionTLS12,
			PreferServerCipherSuites: true,
			NextProtos:               []string{"h2", "http/1.1"},
		},
	}

	var (
		crt = p.Config.HTTPS.Certificate
		key = p.Config.HTTPS.Key
	)
	if tproot := os.Getenv("TELEPRESENCE_ROOT"); tproot != "" {
		crt = filepath.Join(tproot, crt)
		key = filepath.Join(tproot, key)
	}
	go func() {
		err := http.ListenAndServe(p.Ingress.HTTPAddress, http.HandlerFunc(redirectToHTTPS))
		if err != nil {
			log.WithError(err).Fatal("cannot start http proxy")
		}
	}()

	err = srv.ListenAndServeTLS(crt, key)
	if err != nil {
		log.WithError(err).Fatal("cannot start proxy")
		return
	}
}

// Handler returns the HTTP handler that serves the proxy routes.
func (p *WorkspaceProxy) Handler() (http.Handler, error) {
	r := mux.NewRouter()

	// install routes
	handlerConfig, err := NewRouteHandlerConfig(&p.Config, WithDefaultAuth(p.WorkspaceInfoProvider))
	if err != nil {
		return nil, err
	}
	ideRouter, portRouter, foreignRouter := p.WorkspaceRouter(r, p.WorkspaceInfoProvider)
	err = installWorkspaceRoutes(ideRouter, handlerConfig, p.WorkspaceInfoProvider, p.SSHHostSigners)
	if err != nil {
		return nil, err
	}
	err = installWorkspacePortRoutes(portRouter, handlerConfig, p.WorkspaceInfoProvider)
	if err != nil {
		return nil, err
	}
	err = installForeignRoutes(foreignRouter, handlerConfig, p.WorkspaceInfoProvider)
	if err != nil {
		return nil, err
	}
	return r, nil
}

// cipher suites assuming AES-NI (hardware acceleration for AES).
var defaultCipherSuitesWithAESNI = []uint16{
	tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
	tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
	tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
	tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
	tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
	tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
}

// defaultCipherSuites assuming lack of AES-NI (NO hardware acceleration for AES).
var defaultCipherSuitesWithoutAESNI = []uint16{
	tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
	tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
	tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
	tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
	tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
	tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
}

// optimalDefaultCipherSuites returns an appropriate cipher
// suite to use depending on the hardware support for AES.
func optimalDefaultCipherSuites() []uint16 {
	if cpuid.CPU.Supports(cpuid.AESNI) {
		return defaultCipherSuitesWithAESNI
	}
	return defaultCipherSuitesWithoutAESNI
}
