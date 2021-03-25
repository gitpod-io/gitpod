// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"text/template"
	"time"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
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

	routes.HandleDirectIDERoute(r.MatcherFunc(func(req *http.Request, m *mux.RouteMatch) bool {
		return m.Vars != nil && m.Vars[foreignOriginPrefix] != ""
	}))

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
		h.Transport = &blobserveTransport{
			transport: h.Transport,
			Config:    ir.Config.Config,
			resolveImage: func(req *http.Request) string {
				var (
					image = ir.Config.Config.WorkspacePodConfig.SupervisorImage
					path  = strings.TrimPrefix(req.URL.Path, "/"+image)
				)
				if path == "/worker-proxy.js" {
					// worker must be served from the same origin
					return ""
				}
				return image
			},
		}
	}))
}

func (ir *ideRoutes) HandleRoot(route *mux.Route) {
	r := route.Subrouter()
	r.Use(logRouteHandlerHandler("handleRoot"))
	r.Use(ir.Config.CorsHandler)
	r.Use(ir.workspaceMustExistHandler)

	workspaceIDEPass := ir.Config.WorkspaceAuthHandler(
		proxyPass(ir.Config, workspacePodResolver),
	)
	// always hit the blobserver to ensure that blob is downloaded
	r.NewRoute().HandlerFunc(proxyPass(ir.Config, dynamicIDEResolver, func(h *proxyPassConfig) {
		h.Transport = &blobserveTransport{
			transport: h.Transport,
			Config:    ir.Config.Config,
			resolveImage: func(req *http.Request) string {
				info := getWorkspaceInfoFromContext(req.Context())
				if info == nil {
					// no workspace information available - cannot resolve IDE image and path
					return ""
				}
				return info.IDEImage
			},
		}
	}, withHTTPErrorHandler(workspaceIDEPass)))
}

const imagePathSeparator = "/__files__"

// installBlobserveRoutes  implements long-lived caching with versioned URLs, see https://web.dev/http-cache/#versioned-urls
func installBlobserveRoutes(r *mux.Router, config *RouteHandlerConfig) {
	r.Use(logHandler)
	r.Use(handlers.CompressHandler)
	r.Use(logRouteHandlerHandler("BlobserveRootHandler"))
	r.Use(handlers.CORS(
		// CORS headers are stored in the browser cache, we cannot be specific here to allow reuse between workspaces
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "OPTIONS"}),
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
func installWorkspacePortRoutes(r *mux.Router, config *RouteHandlerConfig) error {
	showPortNotFoundPage, err := servePortNotFoundPage(config.Config)
	if err != nil {
		return err
	}

	r.Use(logHandler)
	r.Use(config.WorkspaceAuthHandler)
	// filter all session cookies
	r.Use(sensitiveCookieHandler(config.Config.GitpodInstallation.HostName))

	// forward request to workspace port
	r.NewRoute().HandlerFunc(
		proxyPass(
			config,
			workspacePodPortResolver,
			withHTTPErrorHandler(showPortNotFoundPage),
			withXFrameOptionsFilter(),
		),
	)

	return nil
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
			cookies := removeSensitiveCookies(readCookies(req.Header, ""), domain)
			header := make([]string, 0, len(cookies))
			for _, c := range cookies {
				if c == nil {
					continue
				}

				cookie := c.String()
				if cookie == "" {
					// because we're checking for nil above, it must be that the cookie name is invalid.
					// Some languages have no quarels with producing invalid cookie names, so we must too.
					// See https://github.com/gitpod-io/gitpod/issues/2470 for more details.
					var (
						originalName    = c.Name
						replacementName = fmt.Sprintf("name%d%d", rand.Uint64(), time.Now().Unix())
					)
					c.Name = replacementName
					cookie = c.String()
					if cookie == "" {
						// despite our best efforts, we still couldn't render the cookie. We'll just drop
						// it at this point
						continue
					}

					cookie = strings.Replace(cookie, replacementName, originalName, 1)
					c.Name = originalName
				}

				header = append(header, cookie)
			}

			// using the header string slice here directly would result in multiple cookie header
			// being sent. See https://github.com/gitpod-io/gitpod/issues/2121.
			req.Header["Cookie"] = []string{strings.Join(header, ";")}

			h.ServeHTTP(resp, req)
		})
	}
}

// workspaceMustExistHandler redirects if we don't know about a workspace yet.
func workspaceMustExistHandler(config *Config, infoProvider WorkspaceInfoProvider) mux.MiddlewareFunc {
	return func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
			coords := getWorkspaceCoords(req)
			info := infoProvider.WorkspaceInfo(req.Context(), coords.ID)
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

// region blobserve transport
type blobserveTransport struct {
	transport    http.RoundTripper
	Config       *Config
	resolveImage func(req *http.Request) string
}

func (t *blobserveTransport) RoundTrip(req *http.Request) (resp *http.Response, err error) {
	for {
		resp, err = t.transport.RoundTrip(req)
		if err != nil {
			return nil, err
		}

		if resp.StatusCode >= http.StatusBadRequest {
			respBody, err := io.ReadAll(resp.Body)
			if err != nil {
				return nil, err
			}
			resp.Body.Close()

			if resp.StatusCode == http.StatusServiceUnavailable && string(respBody) == "timeout" {
				// on timeout try again till the client request is cancelled
				// blob server sometimes takes time to pull a new image
				continue
			}

			// treat any client or server error code as a http error
			return nil, fmt.Errorf("blobserver error: (%d) %s", resp.StatusCode, string(respBody))
		}
		break
	}

	if resp.StatusCode != http.StatusOK {
		// only redirect successful responses
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

	image := t.resolveImage(req)
	if image == "" {
		return resp, nil
	}

	resp.Body.Close()
	return t.redirect(image, req)
}

func (t *blobserveTransport) redirect(image string, req *http.Request) (*http.Response, error) {
	path := strings.TrimPrefix(req.URL.Path, "/"+image)
	location := fmt.Sprintf("%s://%s%s/%s%s%s",
		t.Config.GitpodInstallation.Scheme,
		"blobserve",
		t.Config.GitpodInstallation.WorkspaceHostSuffix,
		image,
		imagePathSeparator,
		path,
	)

	header := make(http.Header, 2)
	header.Set("Location", location)
	header.Set("Content-Type", "text/html; charset=utf-8")

	code := http.StatusSeeOther
	var (
		status  = http.StatusText(code)
		content = []byte("<a href=\"" + location + "\">" + status + "</a>.\n\n")
	)

	return &http.Response{
		Request:       req,
		Header:        header,
		Body:          io.NopCloser(bytes.NewReader(content)),
		ContentLength: int64(len(content)),
		StatusCode:    code,
		Status:        status,
	}, nil
}

// endregion

const (
	builtinPagePortNotFound = "port-not-found.html"
)

func servePortNotFoundPage(config *Config) (http.Handler, error) {
	fn := filepath.Join(config.BuiltinPages.Location, builtinPagePortNotFound)
	if tp := os.Getenv("TELEPRESENCE_ROOT"); tp != "" {
		fn = filepath.Join(tp, fn)
	}
	page, err := os.ReadFile(fn)
	if err != nil {
		return nil, err
	}
	page = bytes.ReplaceAll(page, []byte("https://gitpod.io"), []byte(fmt.Sprintf("%s://%s", config.GitpodInstallation.Scheme, config.GitpodInstallation.HostName)))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write(page)
	}), nil
}
