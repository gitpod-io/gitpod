// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gorilla/mux"
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
	srv, err := p.Server()
	if err != nil {
		log.WithError(err).Fatal("cannot initialize proxy - this is likely a configuration issue")
		return
	}

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

// Server is the entry point to the proxy which produces the HTTP server serving the proxy
func (p *WorkspaceProxy) Server() (*http.Server, error) {
	r := mux.NewRouter()

	// install routes
	handlerConfig, err := NewRouteHandlerConfig(&p.Config, WithDefaultAuth(p.WorkspaceInfoProvider))
	if err != nil {
		return nil, err
	}
	theiaRouter, portRouter := p.WorkspaceRouter(r, p.WorkspaceInfoProvider)
	installTheiaRoutes(theiaRouter, handlerConfig, &RouteHandlers{
		theiaRootHandler:            TheiaRootHandler(p.WorkspaceInfoProvider),
		theiaMiniBrowserHandler:     TheiaMiniBrowserHandler,
		theiaFileHandler:            TheiaFileHandler,
		theiaHostedPluginHandler:    TheiaHostedPluginHandler,
		theiaServiceHandler:         TheiaServiceHandler,
		theiaFileUploadHandler:      TheiaFileUploadHandler,
		theiaReadyHandler:           TheiaReadyHandler,
		theiaSupervisorReadyHandler: TheiaSupervisorReadyHandler,
		theiaWebviewHandler:         TheiaWebviewHandler,
	})
	installWorkspacePortRoutes(portRouter, handlerConfig)

	return &http.Server{Addr: p.Address, Handler: r}, nil
}
