// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"bytes"
	"context"
	"fmt"
	"io/ioutil"
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

// installWorkspaceRoutes configures routing of workspace and IDE requests
func installWorkspaceRoutes(r *mux.Router, config *RouteHandlerConfig, ip WorkspaceInfoProvider) {
	r.Use(logHandler)
	r.Use(handlers.CompressHandler)

	// Note: the order of routes defines their priority.
	//       Routes registered first have priority over those that come afterwards.
	routes := newIDERoutes(config, ip)

	// The favicon warants special handling, because we pull that from the supervisor frontend
	// rather than the IDE.
	faviconRouter := r.Path("/favicon.ico").Subrouter()
	faviconRouter.Use(func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
			req.URL.Path = "/_supervisor/frontend/favicon.ico"
			h.ServeHTTP(resp, req)
		})
	})
	routes.HandleSupervisorFrontendRoute(faviconRouter.NewRoute())

	// Theia has a bunch of special routes it probably requires.
	// TODO(cw): figure out if these routes are still required, and how we deal with specialties of other IDEs.
	for _, pp := range []string{"/services", "/file-upload"} {
		routes.HandleDirectIDERoute(r.Path(pp))
	}
	for _, pp := range []string{"/mini-browser", "/file", "/files", "/hostedPlugin", "/webview"} {
		routes.HandleDirectIDERoute(r.PathPrefix(pp))
	}

	routes.HandleSupervisorFrontendRoute(r.PathPrefix("/_supervisor/frontend"))
	routes.HandleDirectSupervisorRoute(r.PathPrefix("/_supervisor/v1/status/supervisor"), false)
	routes.HandleDirectSupervisorRoute(r.PathPrefix("/_supervisor/v1/status/ide"), false)
	routes.HandleDirectSupervisorRoute(r.PathPrefix("/_supervisor/v1"), true)
	routes.HandleDirectSupervisorRoute(r.PathPrefix("/_supervisor"), true)

	routes.HandleRoot(r.NewRoute())
}

func newIDERoutes(config *RouteHandlerConfig, ip WorkspaceInfoProvider) *ideRoutes {
	return &ideRoutes{
		Config:                    config,
		InfoProvider:              ip,
		workspaceMustExistHandler: workspaceMustExistHandler(config.Config, ip),
	}
}

type ideRoutes struct {
	Config       *RouteHandlerConfig
	InfoProvider WorkspaceInfoProvider

	workspaceMustExistHandler mux.MiddlewareFunc
}

func (ir *ideRoutes) HandleDirectIDERoute(route *mux.Route) {
	r := route.Subrouter()
	r.Use(logRouteHandlerHandler("HandleDirectIDERoute"))
	r.Use(ir.Config.CorsHandler)
	r.Use(ir.Config.WorkspaceAuthHandler)
	r.Use(ir.workspaceMustExistHandler)

	r.NewRoute().HandlerFunc(proxyPass(ir.Config, workspacePodResolver))
}

func (ir *ideRoutes) HandleDirectSupervisorRoute(route *mux.Route, authenticated bool) {
	r := route.Subrouter()
	r.Use(logRouteHandlerHandler(fmt.Sprintf("HandleDirectSupervisorRoute (authenticated: %v)", authenticated)))
	r.Use(ir.Config.CorsHandler)
	r.Use(ir.workspaceMustExistHandler)
	if authenticated {
		r.Use(ir.Config.WorkspaceAuthHandler)
	}

	r.NewRoute().HandlerFunc(proxyPass(ir.Config, workspacePodSupervisorResolver))
}

func (ir *ideRoutes) redirect(image string, path string, permanent bool, req *http.Request) (*http.Response, error) {
	var (
		location = ir.resolveRedirectLocation(image, path)
		header   = make(http.Header, 2)
	)
	header.Set("Location", location)
	header.Set("Content-Type", "text/html; charset=utf-8")

	code := http.StatusSeeOther
	if permanent {
		code = http.StatusPermanentRedirect
	}
	var (
		status  = http.StatusText(code)
		content = []byte("<a href=\"" + location + "\">" + status + "</a>.\n\n")
	)

	return &http.Response{
		Request:       req,
		Header:        header,
		Body:          ioutil.NopCloser(bytes.NewReader(content)),
		ContentLength: int64(len(content)),
		StatusCode:    code,
		Status:        status,
	}, nil
}

func (ir *ideRoutes) resolveRedirectLocation(image string, path string) string {
	if ir.Config.Config.GitpodInstallation.WorkspaceHostSuffix != "" {
		return fmt.Sprintf("%s://%s%s/%s%s%s",
			ir.Config.Config.GitpodInstallation.Scheme,
			"blobserve",
			ir.Config.Config.GitpodInstallation.WorkspaceHostSuffix,
			image,
			imagePathSeparator,
			path,
		)
	}
	return fmt.Sprintf("%s://%s/%s/%s%s%s",
		ir.Config.Config.GitpodInstallation.Scheme,
		ir.Config.Config.GitpodInstallation.HostName,
		"blobserve",
		image,
		imagePathSeparator,
		path,
	)
}

type supervisorFrontendBlobserveTransport struct {
	http.RoundTripper
	*ideRoutes
}

func (t *supervisorFrontendBlobserveTransport) RoundTrip(req *http.Request) (resp *http.Response, err error) {
	resp, err = t.RoundTripper.RoundTrip(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		// failed requests should not be redirected
		return resp, nil
	}

	var (
		image = t.Config.Config.WorkspacePodConfig.SupervisorImage
		path  = strings.TrimPrefix(req.URL.Path, "/"+image)
	)
	if path == "/worker-proxy.js" {
		// worker must be served from the same origin
		return resp, nil
	}
	resp.Body.Close()

	// redirects cannot be cached since the supervisor image can be changed between workspace restarts
	permanent := false
	return t.redirect(image, path, permanent, req)
}

func (ir *ideRoutes) HandleSupervisorFrontendRoute(route *mux.Route) {
	if ir.Config.Config.BlobServer == nil {
		// if we don't have blobserve, we serve the supervisor frontend from supervisor directly
		ir.HandleDirectSupervisorRoute(route, false)
		return
	}

	r := route.Subrouter()
	r.Use(logRouteHandlerHandler("SupervisorIDEHostHandler"))
	// strip the frontend prefix, just for good measure
	r.Use(func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
			req.URL.Path = strings.TrimPrefix(req.URL.Path, "/_supervisor/frontend")
			h.ServeHTTP(resp, req)
		})
	})
	// always hit the blobserver to ensure that blob is downloaded
	r.NewRoute().HandlerFunc(proxyPass(ir.Config, func(cfg *Config, req *http.Request) (tgt *url.URL, err error) {
		var dst url.URL
		dst.Scheme = cfg.BlobServer.Scheme
		dst.Host = cfg.BlobServer.Host
		dst.Path = "/" + cfg.WorkspacePodConfig.SupervisorImage
		return &dst, nil
	}, func(h *proxyPassConfig) {
		h.Transport = &supervisorFrontendBlobserveTransport{
			RoundTripper: h.Transport,
			ideRoutes:    ir,
		}
	}))
}

type ideBlobserveTransport struct {
	http.RoundTripper
	*ideRoutes
}

func (t *ideBlobserveTransport) RoundTrip(req *http.Request) (resp *http.Response, err error) {
	resp, err = t.RoundTripper.RoundTrip(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		// failed requests should not be redirected
		return resp, nil
	}

	if req.URL.RawQuery != "" {
		// URLs with query cannot be static, i.e. the server is required to resolve the query
		return resp, nil
	}

	// region use fetch metadata to avoid redirections https://developer.mozilla.org/en-US/docs/Glossary/Fetch_metadata_request_header
	mode := req.Header.Get("Sec-Fetch-Mode")
	dest := req.Header.Get("Sec-Fetch-Dest")
	if mode == "" && strings.Contains(strings.ToLower(resp.Header.Get("Content-Type")), "text/html") {
		// fallback for user agents not supporting fetch metadata to avoid redirecting on user navigation
		mode = "navigate"
	}
	if mode == "navigate" || mode == "nested-navigate" || mode == "websocket" {
		// user navigation and websocket requests should not be redirected
		return resp, nil
	}

	if mode == "same-origin" && !(dest == "worker" || dest == "sharedworker") {
		// same origin should not be redirected, except workers
		// supervisor installs the worker proxy from the workspace origin serving content from the blobserve origin
		return resp, nil
	}
	// endregion

	info := getWorkspaceInfoFromContext(req.Context())
	if info == nil {
		// no workspace information available - cannot resolve Theia image and path
		return resp, nil
	}

	resp.Body.Close()
	var (
		image = info.IDEImage
		path  = strings.TrimPrefix(req.URL.Path, "/"+image)
		// redirects can be cached since the ide image is fixed and cannot be changed between workspace restarts
		permanent = true
	)
	return t.redirect(image, path, permanent, req)

}

func (ir *ideRoutes) HandleRoot(route *mux.Route) {
	if ir.Config.Config.BlobServer == nil {
		ir.handleRootWithoutBlobserve(route)
		return
	}

	r := route.Subrouter()
	r.Use(logRouteHandlerHandler("handleRoot"))
	r.Use(ir.Config.CorsHandler)
	r.Use(ir.workspaceMustExistHandler)

	workspaceIDEPass := ir.Config.WorkspaceAuthHandler(
		proxyPass(ir.Config, workspacePodResolver),
	)
	// always hit the blobserver to ensure that blob is downloaded
	r.NewRoute().HandlerFunc(proxyPass(ir.Config, dynamicIDEResolver, func(h *proxyPassConfig) {
		h.Transport = &ideBlobserveTransport{
			RoundTripper: h.Transport,
			ideRoutes:    ir,
		}
	}, withLongTermCaching(), withHTTPErrorHandler(workspaceIDEPass), withNotFoundHandler(workspaceIDEPass)))
}

func (ir *ideRoutes) handleRootWithoutBlobserve(route *mux.Route) {
	r := route.Subrouter()
	r.Use(logRouteHandlerHandler("handleRootWithoutBlobserve"))
	r.Use(ir.Config.CorsHandler)
	r.Use(ir.workspaceMustExistHandler)

	// We first try and service the request using the static IDE server or blobserve.
	// If that fails, we proxy-pass to the workspace.
	workspaceIDEPass := ir.Config.WorkspaceAuthHandler(
		proxyPass(ir.Config, workspacePodResolver),
	)
	ideAssetPass := proxyPass(ir.Config, staticIDEResolver, withHTTPErrorHandler(workspaceIDEPass))
	r.NewRoute().HandlerFunc(ideAssetPass)
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
	r.NewRoute().Handler(proxyPass(config, targetResolver, withLongTermCaching()))
}

// installWorkspacePortRoutes configures routing for exposed ports
func installWorkspacePortRoutes(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(logHandler)
	r.Use(config.WorkspaceAuthHandler)
	// filter all session cookies
	r.Use(sensitiveCookieHandler(config.Config.GitpodInstallation.HostName))

	// forward request to workspace port
	r.NewRoute().HandlerFunc(
		proxyPass(
			config,
			workspacePodPortResolver,
			withErrorHandler(func(w http.ResponseWriter, req *http.Request, e error) {
				w.WriteHeader(http.StatusInternalServerError)
				fmt.Fprintf(w, e.Error())
			}),
		),
	)
}

// workspacePodResolver resolves to the workspace pod's url from the given request
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

// staticIDEResolver resolves to static IDE server with the statically configured version
func staticIDEResolver(config *Config, req *http.Request) (url *url.URL, err error) {
	targetURL := *req.URL
	targetURL.Scheme = config.TheiaServer.Scheme
	targetURL.Host = config.TheiaServer.Host
	targetURL.Path = config.TheiaServer.StaticVersionPathPrefix
	return &targetURL, nil
}

func dynamicIDEResolver(config *Config, req *http.Request) (res *url.URL, err error) {
	info := getWorkspaceInfoFromContext(req.Context())
	if info == nil {
		log.WithFields(log.OWI("", getWorkspaceCoords(req).ID, "")).Warn("no workspace info available - cannot resolve Theia route")
		return nil, xerrors.Errorf("no workspace information available - cannot resolve Theia route")
	}

	var dst url.URL
	dst.Scheme = config.BlobServer.Scheme
	dst.Host = config.BlobServer.Host
	dst.Path = "/" + info.IDEImage

	return &dst, nil
}

// TODO(gpl) This is currently executed per request: cache/use more performant solution?
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
		// TODO(gpl) For domain-based workspace access with authentication (for accessing the IDE) we need to respond with the precise Origin header that was sent
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

var (
	logContextValueKey  = wsproxyContextKey{}
	infoContextValueKey = wsproxyContextKey{}
)

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

// workspaceMustExistHandler redirects if we don't know about a workspace yet.
func workspaceMustExistHandler(config *Config, infoProvider WorkspaceInfoProvider) mux.MiddlewareFunc {
	return func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
			coords := getWorkspaceCoords(req)
			info := infoProvider.WorkspaceInfo(coords.ID)
			if info == nil {
				log.WithFields(log.OWI("", coords.ID, "")).Info("no workspace info found - redirecting to start")
				redirectURL := fmt.Sprintf("%s://%s/start/#%s", config.GitpodInstallation.Scheme, config.GitpodInstallation.HostName, coords.ID)
				http.Redirect(resp, req, redirectURL, 302)
				return
			}

			h.ServeHTTP(resp, req.WithContext(context.WithValue(req.Context(), infoContextValueKey, info)))
		})
	}
}

// getWorkspaceInfoFromContext retrieves workspace information put there by the workspaceMustExistHandler
func getWorkspaceInfoFromContext(ctx context.Context) *WorkspaceInfo {
	r := ctx.Value(infoContextValueKey)
	rl, ok := r.(*WorkspaceInfo)
	if !ok {
		return nil
	}
	return rl
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
