// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	stdlog "log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gorilla/mux"
	"github.com/klauspost/cpuid/v2"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/common"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/sshproxy"
)

// WorkspaceProxy is the entity which forwards all inbound requests to the relevant workspace pods.
type WorkspaceProxy struct {
	Ingress               HostBasedIngressConfig
	Config                Config
	WorkspaceRouter       WorkspaceRouter
	WorkspaceInfoProvider common.WorkspaceInfoProvider
	SSHGatewayServer      *sshproxy.Server
}

// NewWorkspaceProxy creates a new workspace proxy.
func NewWorkspaceProxy(ingress HostBasedIngressConfig, config Config, workspaceRouter WorkspaceRouter, workspaceInfoProvider common.WorkspaceInfoProvider, sshGatewayServer *sshproxy.Server) *WorkspaceProxy {
	return &WorkspaceProxy{
		Ingress:               ingress,
		Config:                config,
		WorkspaceRouter:       workspaceRouter,
		WorkspaceInfoProvider: workspaceInfoProvider,
		SSHGatewayServer:      sshGatewayServer,
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
func (p *WorkspaceProxy) MustServe(ctx context.Context) {
	handler, err := p.Handler()
	if err != nil {
		log.WithError(err).Fatal("cannot initialize proxy - this is likely a configuration issue")
		return
	}

	httpServer := &http.Server{
		Addr:              p.Ingress.HTTPAddress,
		Handler:           http.HandlerFunc(redirectToHTTPS),
		ErrorLog:          stdlog.New(logrusErrorWriter{}, "", 0),
		ReadTimeout:       1 * time.Second,
		WriteTimeout:      1 * time.Second,
		IdleTimeout:       0,
		ReadHeaderTimeout: 2 * time.Second,
	}

	httpServer.SetKeepAlivesEnabled(false)

	httpsServer := &http.Server{
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
		ErrorLog: stdlog.New(logrusErrorWriter{}, "", 0),
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
		err := httpServer.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.WithError(err).Fatal("cannot start http proxy")
		}
	}()

	go func() {
		err = httpsServer.ListenAndServeTLS(crt, key)
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.WithError(err).Fatal("cannot start proxy")
			return
		}
	}()

	<-ctx.Done()

	shutDownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	err = httpServer.Shutdown(shutDownCtx)
	if err != nil {
		log.WithError(err).Fatal("cannot stop HTTP server")
	}

	err = httpsServer.Shutdown(shutDownCtx)
	if err != nil {
		log.WithError(err).Fatal("cannot stop HTTPS server")
	}
}

// Handler returns the HTTP handler that serves the proxy routes.
func (p *WorkspaceProxy) Handler() (http.Handler, error) {
	r := mux.NewRouter()

	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// install routes
	handlerConfig, err := NewRouteHandlerConfig(&p.Config, WithDefaultAuth(p.WorkspaceInfoProvider))
	if err != nil {
		return nil, err
	}
	ideRouter, portRouter, foreignRouter := p.WorkspaceRouter(r, p.WorkspaceInfoProvider)
	err = installWorkspaceRoutes(ideRouter, handlerConfig, p.WorkspaceInfoProvider, p.SSHGatewayServer)
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

var tlsHandshakeErrorPrefix = []byte("http: TLS handshake error")

type logrusErrorWriter struct{}

func (w logrusErrorWriter) Write(p []byte) (int, error) {
	if bytes.Contains(p, tlsHandshakeErrorPrefix) {
		return len(p), nil
	}

	log.Errorf("%s", string(p))
	return len(p), nil
}
