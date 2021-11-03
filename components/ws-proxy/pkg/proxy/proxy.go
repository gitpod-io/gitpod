// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/gorilla/mux"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// WorkspaceProxy is the entity which forwards all inbound requests to the relevant workspace pods.
type WorkspaceProxy struct {
	Ingress               HostBasedIngressConfig
	Config                Config
	WorkspaceRouter       WorkspaceRouter
	WorkspaceInfoProvider WorkspaceInfoProvider
}

// NewWorkspaceProxy creates a new workspace proxy.
func NewWorkspaceProxy(ingress HostBasedIngressConfig, config Config, workspaceRouter WorkspaceRouter, workspaceInfoProvider WorkspaceInfoProvider) *WorkspaceProxy {
	return &WorkspaceProxy{
		Ingress:               ingress,
		Config:                config,
		WorkspaceRouter:       workspaceRouter,
		WorkspaceInfoProvider: workspaceInfoProvider,
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
	srv := &http.Server{Addr: p.Ingress.HTTPSAddress, Handler: handler}

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
	ideRouter, portRouter, blobserveRouter := p.WorkspaceRouter(r, p.WorkspaceInfoProvider)
	installWorkspaceRoutes(ideRouter, handlerConfig, p.WorkspaceInfoProvider)
	err = installWorkspacePortRoutes(portRouter, handlerConfig, p.WorkspaceInfoProvider)
	if err != nil {
		return nil, err
	}
	installBlobserveRoutes(blobserveRouter, handlerConfig, p.WorkspaceInfoProvider)
	return r, nil
}
