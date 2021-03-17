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

// WorkspaceProxy is the entity which forwards all inbound requests to the relevant workspace pods
type WorkspaceProxy struct {
	Address               string
	Config                Config
	WorkspaceRouter       WorkspaceRouter
	WorkspaceInfoProvider WorkspaceInfoProvider
}

// NewWorkspaceProxy creates a new workspace proxy
func NewWorkspaceProxy(address string, config Config, workspaceRouter WorkspaceRouter, workspaceInfoProvider WorkspaceInfoProvider) *WorkspaceProxy {
	return &WorkspaceProxy{
		Address:               address,
		Config:                config,
		WorkspaceRouter:       workspaceRouter,
		WorkspaceInfoProvider: workspaceInfoProvider,
	}
}

// MustServe starts the proxy and ends the process if doing so fails
func (p *WorkspaceProxy) MustServe() {
	handler, err := p.Handler()
	if err != nil {
		log.WithError(err).Fatal("cannot initialize proxy - this is likely a configuration issue")
		return
	}
	srv := &http.Server{Addr: p.Address, Handler: handler}

	if p.Config.HTTPS.Enabled {
		var (
			crt = p.Config.HTTPS.Certificate
			key = p.Config.HTTPS.Key
		)
		if tproot := os.Getenv("TELEPRESENCE_ROOT"); tproot != "" {
			crt = filepath.Join(tproot, crt)
			key = filepath.Join(tproot, key)
		}
		err = srv.ListenAndServeTLS(crt, key)
	} else {
		err = srv.ListenAndServe()
	}

	if err != nil {
		log.WithError(err).Fatal("cannot start proxy")
		return
	}
}

// Handler returns the HTTP handler that serves the proxy routes
func (p *WorkspaceProxy) Handler() (http.Handler, error) {
	r := mux.NewRouter()

	// install routes
	handlerConfig, err := NewRouteHandlerConfig(&p.Config, WithDefaultAuth(p.WorkspaceInfoProvider))
	if err != nil {
		return nil, err
	}
	theiaRouter, portRouter, blobserveRouter := p.WorkspaceRouter(r, p.WorkspaceInfoProvider)
	installWorkspaceRoutes(theiaRouter, handlerConfig, p.WorkspaceInfoProvider)
	err = installWorkspacePortRoutes(portRouter, handlerConfig)
	if err != nil {
		return nil, err
	}
	installBlobserveRoutes(blobserveRouter, handlerConfig)
	return r, nil
}
