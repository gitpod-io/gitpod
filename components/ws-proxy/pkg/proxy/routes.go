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
	"golang.org/x/xerrors"
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

// installTheiaRoutes configures routing of Theia requests
func installTheiaRoutes(r *mux.Router, config *RouteHandlerConfig, ip WorkspaceInfoProvider) {
	r.Use(logHandler)
	r.Use(handlers.CompressHandler)

	// Precedence depends on order - the further down a route is, the later it comes,
	// the less priority it has.
	TheiaMiniBrowserHandler(r.PathPrefix("/mini-browser").Subrouter(), config)

	TheiaServiceHandler(r.Path("/services").Subrouter(), config)
	TheiaFileUploadHandler(r.Path("/file-upload").Subrouter(), config)

	TheiaFileHandler(r.PathPrefix("/file").Subrouter(), config)
	TheiaFileHandler(r.PathPrefix("/files").Subrouter(), config)

	TheiaHostedPluginHandler(r.PathPrefix("/hostedPlugin").Subrouter(), config)
	TheiaWebviewHandler(r.PathPrefix("/webview").Subrouter(), config)

	supervisorUnauthenticatedAPIHandler := SupervisorAPIHandler(false)
	supervisorAuthenticatedAPIHandler := SupervisorAPIHandler(true)
	supervisorUnauthenticatedAPIHandler(r.PathPrefix("/_supervisor/v1/status/supervisor").Subrouter(), config)
	supervisorUnauthenticatedAPIHandler(r.PathPrefix("/_supervisor/v1/status/ide").Subrouter(), config)
	supervisorAuthenticatedAPIHandler(r.PathPrefix("/_supervisor/v1").Subrouter(), config)

	faviconRouter := r.Path("/favicon.ico").Subrouter()
	faviconRouter.Use(func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
			req.URL.Path = "/_supervisor/frontend/favicon.ico"
			h.ServeHTTP(resp, req)
		})
	})

	// TODO(cw): remove this distinction once blobserve is standard. Then we always want to use blobserve.
	if config.Config.BlobServer != nil {
		SupervisorIDEHostHandler(r.PathPrefix("/_supervisor/frontend").Subrouter(), config)
		SupervisorIDEHostHandler(faviconRouter, config)
	} else {
		supervisorUnauthenticatedAPIHandler(r.PathPrefix("/_supervisor/frontend").Subrouter(), config)
		supervisorUnauthenticatedAPIHandler(faviconRouter, config)
	}

	supervisorAuthenticatedAPIHandler(r.PathPrefix("/_supervisor").Subrouter(), config)

	TheiaRootHandler(r.NewRoute().Subrouter(), config, ip)
}

const imagePathSeparator = "/__files__"

// installBlobserveRoutes  implements long-lived caching with versioned URLs, see https://web.dev/http-cache/#versioned-urls
func installBlobserveRoutes(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(logHandler)
	r.Use(handlers.CompressHandler)
	r.Use(logRouteHandlerHandler("BlobserveRootHandler"))
	r.Use(handlers.CORS(
		// CORS headers are stored in the browser cache, we cannot be specific here to allow resuse between workspaces
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET"}),
	))

	targetResolver := func(cfg *Config, req *http.Request) (tgt *url.URL, err error) {
		segments := strings.SplitN(req.URL.Path, imagePathSeparator, 2)
		image, path := segments[0], segments[1]

		req.URL.Path = path
		req.Header.Add("X-BlobServe-ReadOnly", "true")

		var dst url.URL
		dst.Scheme = cfg.BlobServer.Scheme
		dst.Host = cfg.BlobServer.Host
		dst.Path = image
		return &dst, nil
	}
	r.NewRoute().Handler(proxyPass(config, targetResolver, func(cfg *proxyPassConfig) {
		cfg.ResponseHandler = func(resp *http.Response, req *http.Request) error {
			// tell the browser to cache for 1 year and don't ask the server during this period
			resp.Header.Set("Cache-Control", "public, max-age=31536000")
			return nil
		}
	}))
}

func redirectToBlobserve(w http.ResponseWriter, req *http.Request, config *RouteHandlerConfig, image string) {
	var redirectURL string
	if config.Config.GitpodInstallation.WorkspaceHostSuffix != "" {
		redirectURL = fmt.Sprintf("%s://%s%s/%s%s%s",
			config.Config.GitpodInstallation.Scheme,
			"blobserve",
			config.Config.GitpodInstallation.WorkspaceHostSuffix,
			image,
			imagePathSeparator,
			req.URL.Path,
		)
	} else {
		redirectURL = fmt.Sprintf("%s://%s/%s/%s%s%s",
			config.Config.GitpodInstallation.Scheme,
			config.Config.GitpodInstallation.HostName,
			"blobserve",
			image,
			imagePathSeparator,
			req.URL.Path,
		)
	}
	http.Redirect(w, req, redirectURL, 303)
}

// SupervisorIDEHostHandler serves supervisor's IDE host
func SupervisorIDEHostHandler(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(logRouteHandlerHandler("SupervisorIDEHostHandler"))
	// strip the frontend prefix, just for good measure
	r.Use(func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
			req.URL.Path = strings.TrimPrefix(req.URL.Path, "/_supervisor/frontend")
			h.ServeHTTP(resp, req)
		})
	})

	r.NewRoute().HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		redirectToBlobserve(w, req, config, config.Config.WorkspacePodConfig.SupervisorImage)
	})
}

// TheiaRootHandler handles all requests under / that are not handled by any special case above (expected to be static resources only)
func TheiaRootHandler(r *mux.Router, config *RouteHandlerConfig, infoProvider WorkspaceInfoProvider) {
	r.Use(logRouteHandlerHandler("TheiaRootHandler"))
	r.Use(config.CorsHandler)

	var resolver targetResolver
	if config.Config.BlobServer != nil {
		resolver = dynamicTheiaResolver(infoProvider)
	} else {
		resolver = staticTheiaResolver
	}
	theiaProxyPass := // Use the static theia server as primary source for resources
		proxyPass(config, resolver,
			// If the static theia server returns 404, re-route to the pod itself instead
			withHTTPErrorHandler(
				config.WorkspaceAuthHandler(
					proxyPass(config, workspacePodResolver,
						withWebsocketSupport(),
						withOnProxyErrorRedirectToWorkspaceStartHandler(config.Config),
					),
				),
			),
		)

	if config.Config.BlobServer == nil {
		r.NewRoute().HandlerFunc(theiaProxyPass)
		return
	}

	client := http.Client{Timeout: 30 * time.Second}
	r.NewRoute().HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		mode := req.Header.Get("Sec-Fetch-Mode")
		dest := req.Header.Get("Sec-Fetch-Dest")
		if mode == "navigate" || mode == "nested-navigate" || mode == "websocket" {
			theiaProxyPass.ServeHTTP(w, req)
			return
		}

		if mode == "same-origin" && !(dest == "worker" || dest == "sharedworker") {
			theiaProxyPass.ServeHTTP(w, req)
			return
		}

		if req.URL.RawQuery != "" {
			theiaProxyPass.ServeHTTP(w, req)
			return
		}

		coords := getWorkspaceCoords(req)
		info := infoProvider.WorkspaceInfo(coords.ID)
		if info == nil {
			theiaProxyPass.ServeHTTP(w, req)
			return
		}

		resp, err := client.Get(fmt.Sprintf("%s://%s/%s%s", config.Config.BlobServer.Scheme, config.Config.BlobServer.Host, info.IDEImage, req.URL.Path))
		if err != nil {
			theiaProxyPass.ServeHTTP(w, req)
			return
		}
		if mode == "" && strings.Contains(strings.ToLower(resp.Header.Get("Content-Type")), "text/html") {
			theiaProxyPass.ServeHTTP(w, req)
			return
		}
		defer resp.Body.Close()
		redirectToBlobserve(w, req, config, info.IDEImage)
	})
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
	r.Use(config.WorkspaceAuthHandler)
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
