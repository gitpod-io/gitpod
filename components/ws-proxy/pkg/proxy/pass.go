// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
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

	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// ProxyPassConfig is used as intermediate struct to assemble a configurable proxy
type proxyPassConfig struct {
	TargetResolver  targetResolver
	ResponseHandler []responseHandler
	ErrorHandler    errorHandler
	Transport       http.RoundTripper
}

func (ppc *proxyPassConfig) appendResponseHandler(handler responseHandler) {
	ppc.ResponseHandler = append(ppc.ResponseHandler, handler)
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

	if h.ErrorHandler != nil {
		oeh := h.ErrorHandler
		h.ErrorHandler = func(w http.ResponseWriter, req *http.Request, connectErr error) {
			log.Debugf("could not connect to backend %s: %s", req.URL.String(), connectErrorToCause(connectErr))
			oeh(w, req, connectErr)
		}
	}

	return func(w http.ResponseWriter, req *http.Request) {
		targetURL, err := h.TargetResolver(config.Config, req)
		if err != nil {
			if h.ErrorHandler != nil {
				h.ErrorHandler(w, req, err)
			} else {
				log.WithError(err).Errorf("Unable to resolve targetURL: %s", req.URL.String())
			}
			return
		}

		var originalURL = *req.URL

		// TODO(cw): we should cache the proxy for some time for each target URL
		proxy := httputil.NewSingleHostReverseProxy(targetURL)
		proxy.Transport = h.Transport
		proxy.ModifyResponse = func(resp *http.Response) error {
			url := resp.Request.URL
			if url == nil {
				return xerrors.Errorf("response's request without URL")
			}

			if log.Log.Level <= logrus.DebugLevel && resp.StatusCode >= http.StatusBadRequest {
				dmp, _ := httputil.DumpRequest(resp.Request, false)
				log.WithField("url", url.String()).WithField("req", dmp).WithField("status", resp.Status).Debug("proxied request failed")
			}

			// execute response handlers in order of registration
			for _, handler := range h.ResponseHandler {
				err := handler(resp, req)
				if err != nil {
					return err
				}
			}

			return nil
		}

		proxy.ErrorHandler = func(rw http.ResponseWriter, req *http.Request, err error) {
			if h.ErrorHandler != nil {
				req.URL = &originalURL
				h.ErrorHandler(w, req, err)
				return
			}

			log.WithField("url", originalURL.String()).WithError(err).Error("proxied request failed")
			rw.WriteHeader(http.StatusBadGateway)
		}

		getLog(req.Context()).WithField("targetURL", targetURL.String()).Debug("proxy-passing request")
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

// tell the browser to cache for 1 year and don't ask the server during this period
func withLongTermCaching() proxyPassOpt {
	return func(cfg *proxyPassConfig) {
		cfg.appendResponseHandler(func(resp *http.Response, req *http.Request) error {
			resp.Header.Set("Cache-Control", "public, max-age=31536000")
			return nil
		})
	}
}

func withXFrameOptionsFilter() proxyPassOpt {
	return func(cfg *proxyPassConfig) {
		cfg.appendResponseHandler(func(resp *http.Response, req *http.Request) error {
			resp.Header.Del("X-Frame-Options")
			return nil
		})
	}
}
