// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"text/template"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

// RouteHandlerConfig configures a RouteHandler
type RouteHandlerConfig struct {
	Config               *Config
	DefaultTransport     http.RoundTripper
	CorsHandler          mux.MiddlewareFunc
	WorkspaceAuthHandler mux.MiddlewareFunc
}

// RouteHandlerConfigOpt modifies the router handler config
type RouteHandlerConfigOpt func(*Config, *RouteHandlerConfig)

// WithDefaultAuth enables workspace access authentication
func WithDefaultAuth(infoprov WorkspaceInfoProvider) RouteHandlerConfigOpt {
	return func(config *Config, c *RouteHandlerConfig) {
		c.WorkspaceAuthHandler = WorkspaceAuthHandler(config.GitpodInstallation.HostName, infoprov)
	}
}

// NewRouteHandlerConfig creates a new instance
func NewRouteHandlerConfig(config *Config, opts ...RouteHandlerConfigOpt) (*RouteHandlerConfig, error) {
	corsHandler, err := corsHandler(config.GitpodInstallation.Scheme, config.GitpodInstallation.HostName)
	if err != nil {
		return nil, err
	}

	cfg := &RouteHandlerConfig{
		Config:               config,
		DefaultTransport:     createDefaultTransport(config.TransportConfig),
		CorsHandler:          corsHandler,
		WorkspaceAuthHandler: func(h http.Handler) http.Handler { return h },
	}
	for _, o := range opts {
		o(config, cfg)
	}
	return cfg, nil
}

// RouteHandler is a function that handles a HTTP route
type RouteHandler = func(r *mux.Router, config *RouteHandlerConfig)

// RouteHandlers is the struct that configures the ws-proxys HTTP routes
type RouteHandlers struct {
	theiaRootHandler            RouteHandler
	theiaMiniBrowserHandler     RouteHandler
	theiaFileHandler            RouteHandler
	theiaHostedPluginHandler    RouteHandler
	theiaServiceHandler         RouteHandler
	theiaFileUploadHandler      RouteHandler
	theiaReadyHandler           RouteHandler
	theiaSupervisorReadyHandler RouteHandler
	theiaWebviewHandler         RouteHandler
}

// installTheiaRoutes configures routing of Theia requests
func installTheiaRoutes(r *mux.Router, config *RouteHandlerConfig, rh *RouteHandlers) {
	r.Use(logHandler)
	r.Use(handlers.CompressHandler)

	// Precedence depends on order
	rh.theiaMiniBrowserHandler(r.PathPrefix("/mini-browser").Subrouter(), config)

	rh.theiaServiceHandler(r.Path("/services").Subrouter(), config)
	rh.theiaFileUploadHandler(r.Path("/file-upload").Subrouter(), config)

	rh.theiaFileHandler(r.PathPrefix("/file").Subrouter(), config)
	rh.theiaFileHandler(r.PathPrefix("/files").Subrouter(), config)

	rh.theiaHostedPluginHandler(r.PathPrefix("/hostedPlugin").Subrouter(), config)

	rh.theiaReadyHandler(r.Path("/gitpod/ready").Subrouter(), config)
	rh.theiaSupervisorReadyHandler(r.Path("/supervisor/ready").Subrouter(), config)

	rh.theiaWebviewHandler(r.PathPrefix("/webview").Subrouter(), config)

	rh.theiaRootHandler(r.NewRoute().Subrouter(), config)
}

// TheiaRootHandler handles all requests under / that are not handled by any special case above (expected to be static resources only)
func TheiaRootHandler(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(config.CorsHandler)
	r.NewRoute().
		HandlerFunc(proxyPass(config,
			// Use the static theia server as primary source for resources
			StaticTheiaResolver,
			// On 50x while connecting to workspace pod, redirect to /start
			withOnProxyErrorRedirectToWorkspaceStartHandler(config.Config)))

	// If the static theia server returns 404, re-route to the pod itself instead
	r.NotFoundHandler = config.WorkspaceAuthHandler(
		proxyPass(config, workspacePodResolver,
			withOnProxyErrorRedirectToWorkspaceStartHandler(config.Config)))
}

// TheiaMiniBrowserHandler handles /mini-browser
func TheiaMiniBrowserHandler(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(config.CorsHandler)
	r.Use(config.WorkspaceAuthHandler)
	r.NewRoute().
		HandlerFunc(proxyPass(config, workspacePodResolver))
}

// TheiaFileHandler handles /file and /files
func TheiaFileHandler(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(config.CorsHandler)
	r.Use(config.WorkspaceAuthHandler)
	r.NewRoute().
		HandlerFunc(proxyPass(config,
			workspacePodResolver,
			withOnProxyErrorRedirectToWorkspaceStartHandler(config.Config)))
}

// TheiaHostedPluginHandler handles /hostedPlugin
func TheiaHostedPluginHandler(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(config.CorsHandler)
	r.Use(config.WorkspaceAuthHandler)
	r.NewRoute().
		HandlerFunc(proxyPass(config, workspacePodResolver))
}

// TheiaServiceHandler handles /service
func TheiaServiceHandler(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(config.CorsHandler)
	r.Use(config.WorkspaceAuthHandler)
	r.NewRoute().
		HandlerFunc(proxyPass(config, workspacePodResolver,
			withWebsocketSupport(),
			withOnProxyErrorRedirectToWorkspaceStartHandler(config.Config)))
}

// TheiaFileUploadHandler handles /file-upload
func TheiaFileUploadHandler(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(config.CorsHandler)
	r.Use(config.WorkspaceAuthHandler)
	r.NewRoute().
		HandlerFunc(proxyPass(config, workspacePodResolver,
			withWebsocketSupport(),
			withOnProxyErrorRedirectToWorkspaceStartHandler(config.Config)))
}

// TheiaReadyHandler handles /gitpod/ready
func TheiaReadyHandler(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(config.CorsHandler)
	r.NewRoute().
		HandlerFunc(proxyPass(config, workspacePodResolver,
			withOnProxyErrorRedirectToWorkspaceStartHandler(config.Config)))
}

// TheiaSupervisorReadyHandler handles /supervisor/ready
func TheiaSupervisorReadyHandler(r *mux.Router, config *RouteHandlerConfig) {
	// We MUST NOT proxy-pass to the workspace-internal supervisor endpoint.
	// There's a lot going on there that's not supposed to be available from outside.
	r.Use(config.CorsHandler)
	r.NewRoute().HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
		url, err := workspacePodSupervisorResolver(config.Config, req)
		if err != nil {
			log.WithError(err).Error("cannot answer supervisor/ready call")
			http.Error(resp, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		timeout := 2 * time.Second
		if dl, ok := req.Context().Deadline(); ok {
			timeout = time.Until(dl)
		}
		client := http.Client{Timeout: timeout}
		rresp, err := client.Get(url.String())
		if err != nil {
			log.WithError(err).Error("cannot answer supervisor/ready call")
			http.Error(resp, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}

		rresp.Write(resp)
	})
}

// TheiaWebviewHandler handles /webview
func TheiaWebviewHandler(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(config.CorsHandler)
	r.Use(config.WorkspaceAuthHandler)
	r.NewRoute().
		HandlerFunc(proxyPass(config, workspacePodResolver,
			withWebsocketSupport()))
}

// installWorkspacePortRoutes configures routing for exposed ports
func installWorkspacePortRoutes(r *mux.Router, config *RouteHandlerConfig) {
	// filter all session cookies
	r.Use(sensitiveCookieHandler(config.Config.GitpodInstallation.HostName))
	r.Use(handlers.CompressHandler)

	// forward request to workspace port
	r.NewRoute().
		HandlerFunc(proxyPass(config,
			workspacePodPortResolver,
			withWebsocketSupport()))
}

// workspacePodResolver resolves to the workspace pods Theia url from the given request
func workspacePodResolver(config *Config, req *http.Request) (url *url.URL, err error) {
	coords := getWorkspaceCoords(req)
	return buildWorkspacePodURL(config.WorkspacePodConfig.ServiceTemplate, coords.ID, fmt.Sprint(config.WorkspacePodConfig.TheiaPort))
}

// workspacePodPortResolver resolves to the workspace pods ports
func workspacePodPortResolver(config *Config, req *http.Request) (url *url.URL, err error) {
	coords := getWorkspaceCoords(req)
	return buildWorkspacePodURL(config.WorkspacePodConfig.PortServiceTemplate, coords.ID, coords.Port)
}

// workspacePodSupervisorResolver resolves to the workspace pods Supervisor url from the given request
func workspacePodSupervisorResolver(config *Config, req *http.Request) (url *url.URL, err error) {
	coords := getWorkspaceCoords(req)
	return buildWorkspacePodURL(config.WorkspacePodConfig.ServiceTemplate, coords.ID, fmt.Sprint(config.WorkspacePodConfig.SupervisorPort))
}

// StaticTheiaResolver resolves to static theia server with the statically configured version
func StaticTheiaResolver(config *Config, req *http.Request) (url *url.URL, err error) {
	targetURL := *req.URL
	targetURL.Scheme = config.TheiaServer.Scheme
	targetURL.Host = config.TheiaServer.Host
	targetURL.Path = config.TheiaServer.StaticVersionPathPrefix
	return &targetURL, nil
}

// TODO This is currently executed per request: cache/use more performant solution?
func buildWorkspacePodURL(tmpl string, workspaceID string, port string) (*url.URL, error) {
	tpl, err := template.New("host").Parse(tmpl)
	if err != nil {
		return nil, err
	}

	var out bytes.Buffer
	err = tpl.Execute(&out, map[string]string{
		"workspaceID": workspaceID,
		"port":        port,
	})
	if err != nil {
		return nil, err
	}

	return url.Parse(out.String())
}

// corsHandler produces the CORS handler for workspaces
func corsHandler(scheme, hostname string) (mux.MiddlewareFunc, error) {
	origin := fmt.Sprintf("%s://%s", scheme, hostname)

	domainRegex := strings.ReplaceAll(hostname, ".", "\\.")
	originRegex, err := regexp.Compile(".*" + domainRegex)
	if err != nil {
		return nil, err
	}

	return handlers.CORS(
		handlers.AllowedOriginValidator(func(origin string) bool {
			// Is the origin a subdomain of the installations hostname?
			matches := originRegex.Match([]byte(origin))
			return matches
		}),
		// TODO For domain-based workspace access with authentication (for accessing Theia) we need to respond with the precise Origin header that was sent
		handlers.AllowedOrigins([]string{origin}),
		handlers.AllowedMethods([]string{
			"GET",
			"POST",
			"OPTIONS",
		}),
		handlers.AllowedHeaders([]string{
			// "Accept", "Accept-Language", "Content-Language" are allowed per default
			"Cache-Control",
			"Content-Type",
			"DNT",
			"If-Modified-Since",
			"Keep-Alive",
			"Origin",
			"User-Agent",
			"X-Requested-With",
		}),
		handlers.AllowCredentials(),
		// required to be able to read Authorization header in frontend
		handlers.ExposedHeaders([]string{"Authorization"}),
		handlers.MaxAge(60),
		handlers.OptionStatusCode(200),
	), nil
}

type wsproxyContextKey struct{}

var logContextValueKey = wsproxyContextKey{}

func logHandler(h http.Handler) http.Handler {
	return http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
		var (
			vars = mux.Vars(req)
			wsID = vars[workspaceIDIdentifier]
			port = vars[workspacePortIdentifier]
		)
		entry := log.
			WithField("workspaceId", wsID).
			WithField("portID", port).
			WithField("url", req.URL.String())
		ctx := context.WithValue(req.Context(), logContextValueKey, entry)
		req = req.WithContext(ctx)

		h.ServeHTTP(resp, req)
	})
}

func getLog(ctx context.Context) *logrus.Entry {
	r := ctx.Value(logContextValueKey)
	rl, ok := r.(*logrus.Entry)
	if rl == nil || !ok {
		return log.Log
	}

	return rl
}

func sensitiveCookieHandler(domain string) func(h http.Handler) http.Handler {
	return func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
			cookies := removeSensitiveCookies(req.Cookies(), domain)
			header := make([]string, len(cookies))
			for i, c := range cookies {
				header[i] = c.String()
			}
			req.Header["Cookie"] = header

			h.ServeHTTP(resp, req)
		})
	}
}

// removeSensitiveCookies all sensitive cookies from the list.
// This function modifies the slice in-place.
func removeSensitiveCookies(cookies []*http.Cookie, domain string) []*http.Cookie {
	hostnamePrefix := domain
	for _, c := range []string{" ", "-", "."} {
		hostnamePrefix = strings.ReplaceAll(hostnamePrefix, c, "_")
	}
	hostnamePrefix = "_" + hostnamePrefix + "_"

	n := 0
	for _, c := range cookies {
		if strings.EqualFold(c.Name, hostnamePrefix) {
			// skip session cookie
			continue
		}
		if strings.HasPrefix(c.Name, hostnamePrefix) && strings.HasSuffix(c.Name, "_port_auth_") {
			// skip port auth cookie
			continue
		}
		if strings.HasPrefix(c.Name, hostnamePrefix) && strings.HasSuffix(c.Name, "_owner_") {
			// skip owner token
			continue
		}
		log.WithField("hostnamePrefix", hostnamePrefix).WithField("name", c.Name).Debug("keeping cookie")
		cookies[n] = c
		n++
	}
	return cookies[:n]
}
