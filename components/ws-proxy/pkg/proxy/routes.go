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

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
)

const (
	ideIndexQueryMarker = "gitpod-ide-index"
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
	theiaRootHandler         RouteHandler
	theiaMiniBrowserHandler  RouteHandler
	theiaFileHandler         RouteHandler
	theiaHostedPluginHandler RouteHandler
	theiaServiceHandler      RouteHandler
	theiaFileUploadHandler   RouteHandler
	theiaWebviewHandler      RouteHandler

	supervisorAuthenticatedAPIHandler   RouteHandler
	supervisorUnauthenticatedAPIHandler RouteHandler
	supervisorIDEHostHandler            RouteHandler
}

// DefaultRouteHandlers installs the default route handlers
func DefaultRouteHandlers(ip WorkspaceInfoProvider) *RouteHandlers {
	return &RouteHandlers{
		theiaRootHandler:                    TheiaRootHandler(ip),
		theiaFileHandler:                    TheiaFileHandler,
		theiaFileUploadHandler:              TheiaFileUploadHandler,
		theiaHostedPluginHandler:            TheiaHostedPluginHandler,
		theiaMiniBrowserHandler:             TheiaMiniBrowserHandler,
		theiaServiceHandler:                 TheiaServiceHandler,
		theiaWebviewHandler:                 TheiaWebviewHandler,
		supervisorAuthenticatedAPIHandler:   SupervisorAPIHandler(true),
		supervisorUnauthenticatedAPIHandler: SupervisorAPIHandler(false),
		supervisorIDEHostHandler:            SupervisorIDEHostHandler,
	}
}

// installTheiaRoutes configures routing of Theia requests
func installTheiaRoutes(r *mux.Router, config *RouteHandlerConfig, rh *RouteHandlers) {
	r.Use(logHandler)
	r.Use(handlers.CompressHandler)

	// Precedence depends on order - the further down a route is, the later it comes,
	// the less priority it has.
	rh.theiaMiniBrowserHandler(r.PathPrefix("/mini-browser").Subrouter(), config)

	rh.theiaServiceHandler(r.Path("/services").Subrouter(), config)
	rh.theiaFileUploadHandler(r.Path("/file-upload").Subrouter(), config)

	rh.theiaFileHandler(r.PathPrefix("/file").Subrouter(), config)
	rh.theiaFileHandler(r.PathPrefix("/files").Subrouter(), config)

	rh.theiaHostedPluginHandler(r.PathPrefix("/hostedPlugin").Subrouter(), config)
	rh.theiaWebviewHandler(r.PathPrefix("/webview").Subrouter(), config)

	rh.supervisorUnauthenticatedAPIHandler(r.PathPrefix("/_supervisor/v1/status/supervisor").Subrouter(), config)
	rh.supervisorUnauthenticatedAPIHandler(r.PathPrefix("/_supervisor/v1/status/ide").Subrouter(), config)
	rh.supervisorAuthenticatedAPIHandler(r.PathPrefix("/_supervisor/v1").Subrouter(), config)
	// TODO(cw): remove this distinction once blobserve is standard. Then we always want to use blobserve.
	if config.Config.BlobServer != nil {
		rh.supervisorIDEHostHandler(r.PathPrefix("/_supervisor/frontend").Subrouter(), config)
	} else {
		rh.supervisorUnauthenticatedAPIHandler(r.PathPrefix("/_supervisor/frontend").Subrouter(), config)
	}

	rh.supervisorAuthenticatedAPIHandler(r.PathPrefix("/_supervisor").Subrouter(), config)

	// TODO(cw): we just enable the IDE host route if blobserver is active. Once blobserve is standard,
	//           remove this branch and always register the handler.
	if config.Config.BlobServer != nil {
		rh.supervisorIDEHostHandler(
			r.Path("/").
				MatcherFunc(func(req *http.Request, match *mux.RouteMatch) bool {
					return matchIDEQuery(false)(req, match) && !isWebsocketRequest(req)
				}).
				Subrouter(),
			config,
		)
		rh.supervisorIDEHostHandler(r.Path("/index.html").MatcherFunc(matchIDEQuery(false)).Subrouter(), config)
	}
	rh.theiaRootHandler(r.NewRoute().Subrouter(), config)
}

func matchIDEQuery(mustBePresent bool) mux.MatcherFunc {
	return func(req *http.Request, match *mux.RouteMatch) bool {
		_, present := req.URL.Query()[ideIndexQueryMarker]
		if mustBePresent && present {
			return true
		}
		if !mustBePresent && !present {
			return true
		}
		return false
	}
}

// SupervisorIDEHostHandler matches only when the request is / or /index.html and serves supervisor's IDE host index.html
func SupervisorIDEHostHandler(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(logRouteHandlerHandler("SupervisorIDEHostHandler"))
	// strip the frontend prefix, just for good measure
	r.Use(func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
			req.URL.Path = strings.TrimPrefix(req.URL.Path, "/_supervisor/frontend")
			h.ServeHTTP(resp, req)
		})
	})
	r.NewRoute().Handler(proxyPass(config, func(cfg *Config, req *http.Request) (tgt *url.URL, err error) {
		var dst url.URL
		dst.Scheme = cfg.BlobServer.Scheme
		dst.Host = cfg.BlobServer.Host
		dst.Path = "/" + cfg.WorkspacePodConfig.SupervisorImage
		return &dst, nil
	}))
}

// TheiaRootHandler handles all requests under / that are not handled by any special case above (expected to be static resources only)
func TheiaRootHandler(infoProvider WorkspaceInfoProvider) RouteHandler {
	ideQueryMatch := matchIDEQuery(true)
	return func(r *mux.Router, config *RouteHandlerConfig) {
		r.Use(logRouteHandlerHandler("TheiaRootHandler"))
		var reslv targetResolver
		if config.Config.BlobServer != nil {
			reslv = dynamicTheiaResolver(infoProvider)
		} else {
			reslv = staticTheiaResolver
		}
		resolver := func(config *Config, req *http.Request) (*url.URL, error) {
			if ideQueryMatch(req, nil) {
				req.URL.Path = "/index.html"
			}
			return reslv(config, req)
		}

		r.Use(config.CorsHandler)
		r.NewRoute().HandlerFunc(
			// Use the static theia server as primary source for resources
			proxyPass(config, resolver,
				// If the static theia server returns 404, re-route to the pod itself instead
				withErrorHandler(
					config.WorkspaceAuthHandler(
						proxyPass(config, workspacePodResolver,
							withWebsocketSupport(),
							withOnProxyErrorRedirectToWorkspaceStartHandler(config.Config),
						),
					),
				),
			),
		)
	}
}

// TheiaMiniBrowserHandler handles /mini-browser
func TheiaMiniBrowserHandler(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(logRouteHandlerHandler("TheiaMiniBrowserHandler"))
	r.Use(config.CorsHandler)
	r.Use(config.WorkspaceAuthHandler)
	r.NewRoute().
		HandlerFunc(proxyPass(config, workspacePodResolver))
}

// TheiaFileHandler handles /file and /files
func TheiaFileHandler(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(logRouteHandlerHandler("TheiaFileHandler"))
	r.Use(config.CorsHandler)
	r.Use(config.WorkspaceAuthHandler)
	r.NewRoute().
		HandlerFunc(proxyPass(config,
			workspacePodResolver,
			withOnProxyErrorRedirectToWorkspaceStartHandler(config.Config)))
}

// TheiaHostedPluginHandler handles /hostedPlugin
func TheiaHostedPluginHandler(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(logRouteHandlerHandler("TheiaHostedPluginHandler"))
	r.Use(config.CorsHandler)
	r.Use(config.WorkspaceAuthHandler)
	r.NewRoute().
		HandlerFunc(proxyPass(config, workspacePodResolver))
}

// TheiaServiceHandler handles /service
func TheiaServiceHandler(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(logRouteHandlerHandler("TheiaServiceHandler"))
	r.Use(config.CorsHandler)
	r.Use(config.WorkspaceAuthHandler)
	r.NewRoute().
		HandlerFunc(proxyPass(config, workspacePodResolver,
			withWebsocketSupport(),
			withOnProxyErrorRedirectToWorkspaceStartHandler(config.Config)))
}

// TheiaFileUploadHandler handles /file-upload
func TheiaFileUploadHandler(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(logRouteHandlerHandler("TheiaFileUploadHandler"))
	r.Use(config.CorsHandler)
	r.Use(config.WorkspaceAuthHandler)
	r.NewRoute().
		HandlerFunc(proxyPass(config, workspacePodResolver,
			withWebsocketSupport(),
			withOnProxyErrorRedirectToWorkspaceStartHandler(config.Config)))
}

// SupervisorAPIHandler handles requests for supervisor's API endpoint
func SupervisorAPIHandler(authenticated bool) RouteHandler {
	return func(r *mux.Router, config *RouteHandlerConfig) {
		r.Use(config.CorsHandler)
		if authenticated {
			r.Use(logRouteHandlerHandler("SupervisorAuthenticatedAPIHandler"))
			r.Use(config.WorkspaceAuthHandler)
		} else {
			r.Use(logRouteHandlerHandler("SupervisorUnauthenticatedAPIHandler"))
		}

		r.NewRoute().
			HandlerFunc(proxyPass(config, workspacePodSupervisorResolver))
	}
}

// TheiaWebviewHandler handles /webview
func TheiaWebviewHandler(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(logRouteHandlerHandler("TheiaWebviewHandler"))
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

// staticTheiaResolver resolves to static theia server with the statically configured version
func staticTheiaResolver(config *Config, req *http.Request) (url *url.URL, err error) {
	targetURL := *req.URL
	targetURL.Scheme = config.TheiaServer.Scheme
	targetURL.Host = config.TheiaServer.Host
	targetURL.Path = config.TheiaServer.StaticVersionPathPrefix
	return &targetURL, nil
}

func dynamicTheiaResolver(infoProvider WorkspaceInfoProvider) targetResolver {
	return func(config *Config, req *http.Request) (res *url.URL, err error) {
		coords := getWorkspaceCoords(req)
		info := infoProvider.WorkspaceInfo(coords.ID)
		if info == nil {
			log.WithFields(log.OWI("", coords.ID, "")).Warn("no workspace info available - cannot resolve Theia route")
			return nil, xerrors.Errorf("no workspace information available - cannot resolve Theia route")
		}

		var dst url.URL
		dst.Scheme = config.BlobServer.Scheme
		dst.Host = config.BlobServer.Host
		dst.Path = "/" + info.IDEImage

		return &dst, nil
	}
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

func logRouteHandlerHandler(routeHandlerName string) mux.MiddlewareFunc {
	return func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
			getLog(req.Context()).WithField("routeHandler", routeHandlerName).Info("hit route handler")
			h.ServeHTTP(resp, req)
		})
	}
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
