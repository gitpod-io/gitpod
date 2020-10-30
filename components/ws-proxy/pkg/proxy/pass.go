// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"fmt"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"

	"github.com/koding/websocketproxy"
)

// ProxyPassConfig is used as intermediate struct to assemble a configurable proxy
type proxyPassConfig struct {
	TargetResolver   targetResolver
	ResponseHandler  responseHandler
	ErrorHandler     errorHandler
	Transport        http.RoundTripper
	WebsocketSupport bool
}

// proxyPassOpt allows to compose ProxyHandler options
type proxyPassOpt func(h *proxyPassConfig)

// errorHandler is a function that handles an error that occurred during proxying of a HTTP request
type errorHandler func(http.ResponseWriter, *http.Request, error)

// targetResolver is a function that determines to which target to forward the given HTTP request to
type targetResolver func(*Config, *http.Request) (*url.URL, error)

type responseHandler func(*http.Response, *http.Request) error

// proxyPass is the function that assembles a ProxyHandler from the config, a resolver and various options and returns a http.HandlerFunc
func proxyPass(config *RouteHandlerConfig, resolver targetResolver, opts ...proxyPassOpt) http.HandlerFunc {
	h := proxyPassConfig{
		Transport: config.DefaultTransport,
	}
	for _, o := range opts {
		o(&h)
	}
	h.TargetResolver = resolver

	var eh errorHandler
	if h.ErrorHandler != nil {
		eh = func(w http.ResponseWriter, req *http.Request, connectErr error) {
			log.Debugf("could not connect to backend %s: %s", req.URL.String(), connectErrorToCause(connectErr))

			h.ErrorHandler(w, req, connectErr)
		}
	}

	// proxy constructors
	createWebsocketProxy := func(h *proxyPassConfig, targetURL *url.URL) http.Handler {
		// TODO configure custom IdleConnTimeout for websockets
		proxy := websocketproxy.NewProxy(targetURL)
		return proxy
	}
	createRegularProxy := func(h *proxyPassConfig, targetURL *url.URL) http.Handler {
		proxy := httputil.NewSingleHostReverseProxy(targetURL)
		proxy.Transport = h.Transport
		proxy.ErrorHandler = eh
		proxy.ModifyResponse = func(resp *http.Response) error {
			url := resp.Request.URL
			if url == nil {
				return xerrors.Errorf("response's request without URL")
			}

			if log.Log.Level <= logrus.DebugLevel && resp.StatusCode != http.StatusOK {
				dmp, _ := httputil.DumpRequest(resp.Request, false)
				log.WithField("url", url.String()).WithField("req", dmp).WithField("status", resp.Status).Debug("proxied request failed")
			}
			if resp.StatusCode == http.StatusNotFound {
				return fmt.Errorf("not found")
			}
			return nil
		}
		return proxy
	}

	return func(w http.ResponseWriter, req *http.Request) {
		targetURL, err := h.TargetResolver(config.Config, req)
		if err != nil {
			log.WithError(err).Errorf("Unable to resolve targetURL: %s", req.URL.String())
			return
		}

		// TODO Would it make sense to cache these constructs per target URL?
		var (
			proxy       http.Handler
			proxyType   string
			originalURL = *req.URL
		)
		if h.WebsocketSupport && isWebsocketRequest(req) {
			if targetURL.Scheme == "https" {
				targetURL.Scheme = "wss"
			} else if targetURL.Scheme == "http" {
				targetURL.Scheme = "ws"
			}
			proxy = createWebsocketProxy(&h, targetURL)
			proxyType = "websocket"
		} else {
			proxy = createRegularProxy(&h, targetURL)
			proxyType = "regular"
		}

		if proxy, ok := proxy.(*httputil.ReverseProxy); ok {
			if proxy.ErrorHandler != nil {
				orgErrHndlr := proxy.ErrorHandler
				proxy.ErrorHandler = func(w http.ResponseWriter, req *http.Request, err error) {
					req.URL = &originalURL
					orgErrHndlr(w, req, err)
				}
			}
			if h.ResponseHandler != nil {
				originalModifyResponse := proxy.ModifyResponse
				proxy.ModifyResponse = func(resp *http.Response) error {
					err := originalModifyResponse(resp)
					if err != nil {
						return err
					}
					return h.ResponseHandler(resp, req)
				}
			}
		}

		getLog(req.Context()).WithField("targetURL", targetURL.String()).WithField("proxyType", proxyType).Debug("proxy-passing request")
		proxy.ServeHTTP(w, req)
	}
}

func isWebsocketRequest(req *http.Request) bool {
	return strings.ToLower(req.Header.Get("Connection")) == "upgrade" && strings.ToLower(req.Header.Get("Upgrade")) == "websocket"
}

func connectErrorToCause(err error) string {
	if err == nil {
		return ""
	}

	if netError, ok := err.(net.Error); ok && netError.Timeout() {
		return "Connect timeout"
	}

	switch t := err.(type) {
	case *net.OpError:
		if t.Op == "dial" {
			return fmt.Sprintf("Unknown host: %s", err.Error())
		} else if t.Op == "read" {
			return fmt.Sprintf("Connection refused: %s", err.Error())
		}

	case syscall.Errno:
		if t == syscall.ECONNREFUSED {
			return "Connection refused"
		}
	}

	return err.Error()
}

// withOnProxyErrorRedirectToWorkspaceStartHandler is an error handler that redirects to gitpod.io/start/#<wsid>
func withOnProxyErrorRedirectToWorkspaceStartHandler(config *Config) proxyPassOpt {
	return func(h *proxyPassConfig) {
		h.ErrorHandler = func(w http.ResponseWriter, req *http.Request, err error) {
			// the default impl reports all errors as 502, so we'll do the same with the rest
			ws := getWorkspaceCoords(req)
			redirectURL := fmt.Sprintf("%s://%s/start/#%s", config.GitpodInstallation.Scheme, config.GitpodInstallation.HostName, ws.ID)
			http.Redirect(w, req, redirectURL, 302)
		}
	}
}

func withHTTPErrorHandler(h http.Handler) proxyPassOpt {
	return func(cfg *proxyPassConfig) {
		cfg.ErrorHandler = func(w http.ResponseWriter, req *http.Request, err error) {
			h.ServeHTTP(w, req)
		}
	}
}

func withErrorHandler(h errorHandler) proxyPassOpt {
	return func(cfg *proxyPassConfig) {
		cfg.ErrorHandler = h
	}
}

// // withTransport allows to configure a http.RoundTripper that handles the actual sending and receiving of the HTTP request to the proxy target
// func withTransport(transport http.RoundTripper) proxyPassOpt {
// 	return func(h *proxyPassConfig) {
// 		h.Transport = transport
// 	}
// }

// withWebsocketSupport treats this route as websocket route
func withWebsocketSupport() proxyPassOpt {
	return func(h *proxyPassConfig) {
		h.WebsocketSupport = true
	}
}

func createDefaultTransport(config *TransportConfig) *http.Transport {
	// TODO equivalent of client_max_body_size 2048m; necessary ???
	// this is based on http.DefaultTransport, with some values exposed to config
	return &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   time.Duration(config.ConnectTimeout), // default: 30s
			KeepAlive: 30 * time.Second,
			DualStack: true,
		}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          config.MaxIdleConns,                   // default: 100
		IdleConnTimeout:       time.Duration(config.IdleConnTimeout), // default: 90s
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
}
