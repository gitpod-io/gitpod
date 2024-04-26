// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	crand "crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"

	"github.com/gitpod-io/golang-crypto/ssh"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
	gitpod "github.com/gitpod-io/gitpod/gitpod-protocol"
	"github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/common"
	"github.com/gitpod-io/gitpod/ws-proxy/pkg/sshproxy"
)

// RouteHandlerConfig configures a RouteHandler.
type RouteHandlerConfig struct {
	Config               *Config
	DefaultTransport     http.RoundTripper
	CorsHandler          mux.MiddlewareFunc
	WorkspaceAuthHandler mux.MiddlewareFunc
}

// RouteHandlerConfigOpt modifies the router handler config.
type RouteHandlerConfigOpt func(*Config, *RouteHandlerConfig)

// WithDefaultAuth enables workspace access authentication.
func WithDefaultAuth(infoprov common.WorkspaceInfoProvider) RouteHandlerConfigOpt {
	return func(config *Config, c *RouteHandlerConfig) {
		c.WorkspaceAuthHandler = WorkspaceAuthHandler(config.GitpodInstallation.HostName, infoprov)
	}
}

// NewRouteHandlerConfig creates a new instance.
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

// RouteHandler is a function that handles a HTTP route.
type RouteHandler = func(r *mux.Router, config *RouteHandlerConfig)

// installWorkspaceRoutes configures routing of workspace and IDE requests.
func installWorkspaceRoutes(r *mux.Router, config *RouteHandlerConfig, ip common.WorkspaceInfoProvider, sshGatewayServer *sshproxy.Server) error {
	r.Use(logHandler)

	// Note: the order of routes defines their priority.
	//       Routes registered first have priority over those that come afterwards.
	routes := newIDERoutes(config, ip)

	// if sshGatewayServer not nil, we use /_ssh/host_keys to provider public host key
	if sshGatewayServer != nil {
		routes.HandleSSHHostKeyRoute(r.Path("/_ssh/host_keys"), sshGatewayServer.HostKeys)
		routes.HandleSSHOverWebsocketTunnel(r.Path("/_ssh/tunnel"), sshGatewayServer)

		// This is for backward compatibility.
		routes.HandleSSHOverWebsocketTunnel(r.Path("/_supervisor/tunnel/ssh"), sshGatewayServer)
		routes.HandleCreateKeyRoute(r.Path("/_supervisor/v1/ssh_keys/create"), sshGatewayServer.HostKeys)
	}

	// The favicon warants special handling, because we pull that from the supervisor frontend
	// rather than the IDE.
	faviconRouter := r.Path("/favicon.ico").Subrouter()
	faviconRouter.Use(handlers.CompressHandler)
	faviconRouter.Use(func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
			req.URL.Path = "/_supervisor/frontend/favicon.ico"
			h.ServeHTTP(resp, req)
		})
	})
	routes.HandleSupervisorFrontendRoute(faviconRouter.NewRoute())

	routes.HandleDirectSupervisorRoute(enableCompression(r).PathPrefix("/_supervisor/frontend").MatcherFunc(func(r *http.Request, rm *mux.RouteMatch) bool {
		return rm.Vars[common.DebugWorkspaceIdentifier] == "true"
	}), false)
	routes.HandleSupervisorFrontendRoute(enableCompression(r).PathPrefix("/_supervisor/frontend"))

	routes.HandleDirectSupervisorRoute(r.PathPrefix("/_supervisor/v1/status/supervisor"), false)
	routes.HandleDirectSupervisorRoute(r.PathPrefix("/_supervisor/v1/status/ide"), false)
	routes.HandleDirectSupervisorRoute(r.PathPrefix("/_supervisor/v1"), true)
	routes.HandleDirectSupervisorRoute(r.PathPrefix("/_supervisor"), true)

	rootRouter := enableCompression(r)
	rootRouter.Use(func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
			// This is just an alias to callback.html to make its purpose more explicit,
			// it will be served by blobserve.
			if req.URL.Path == "/vscode-extension-auth-callback" {
				req.URL.Path = "/callback.html"
			}
			h.ServeHTTP(resp, req)
		})
	})
	err := installDebugWorkspaceRoutes(rootRouter.MatcherFunc(func(r *http.Request, rm *mux.RouteMatch) bool {
		return rm.Vars[common.DebugWorkspaceIdentifier] == "true"
	}).Subrouter(), routes.Config, routes.InfoProvider)
	if err != nil {
		return err
	}
	routes.HandleRoot(rootRouter.NewRoute())
	return nil
}

func enableCompression(r *mux.Router) *mux.Router {
	res := r.NewRoute().Subrouter()
	res.Use(handlers.CompressHandler)
	return res
}

func newIDERoutes(config *RouteHandlerConfig, ip common.WorkspaceInfoProvider) *ideRoutes {
	return &ideRoutes{
		Config:                    config,
		InfoProvider:              ip,
		workspaceMustExistHandler: workspaceMustExistHandler(config.Config, ip),
	}
}

type ideRoutes struct {
	Config       *RouteHandlerConfig
	InfoProvider common.WorkspaceInfoProvider

	workspaceMustExistHandler mux.MiddlewareFunc
}

func (ir *ideRoutes) HandleSSHHostKeyRoute(route *mux.Route, hostKeyList []ssh.Signer) {
	shk := make([]struct {
		Type    string `json:"type"`
		HostKey string `json:"host_key"`
	}, len(hostKeyList))
	for i, hk := range hostKeyList {
		shk[i].Type = hk.PublicKey().Type()
		shk[i].HostKey = base64.StdEncoding.EncodeToString(hk.PublicKey().Marshal())
	}
	byt, err := json.Marshal(shk)
	if err != nil {
		log.WithError(err).Error("ssh_host_key router setup failed")
		return
	}
	r := route.Subrouter()
	r.Use(logRouteHandlerHandler("HandleSSHHostKeyRoute"))
	r.Use(ir.Config.CorsHandler)
	r.NewRoute().HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		rw.Header().Add("Content-Type", "application/json")
		rw.Write(byt)
	})
}

func (ir *ideRoutes) HandleCreateKeyRoute(route *mux.Route, hostKeyList []ssh.Signer) {
	r := route.Subrouter()
	r.Use(logRouteHandlerHandler("HandleCreateKeyRoute"))
	r.Use(ir.Config.CorsHandler)
	r.Use(ir.workspaceMustExistHandler)
	r.Use(ir.Config.WorkspaceAuthHandler)

	r.NewRoute().HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := struct {
			Privatekey string `json:"privateKey"`
			UserName   string `json:"userName"`
			HostKey    struct {
				Type  string `json:"type"`
				Value string `json:"value"`
			} `json:"hostKey"`
		}{}

		privateKey, err := ecdsa.GenerateKey(elliptic.P256(), crand.Reader)
		if err != nil {
			log.WithError(err).Error("failed to generate key")
			return
		}

		block, err := ssh.MarshalPrivateKey(privateKey, "")
		if err != nil {
			log.WithError(err).Error("failed to marshal key")
			return
		}
		resp.Privatekey = string(pem.EncodeToMemory(block))
		resp.UserName = "gitpod"

		var hostKey ssh.Signer
		for _, hk := range hostKeyList {
			if hk.PublicKey().Type() != ssh.KeyAlgoRSA {
				hostKey = hk
				break
			}
			if hostKey == nil {
				hostKey = hk
			}
		}
		resp.HostKey.Type = hostKey.PublicKey().Type()
		resp.HostKey.Value = base64.StdEncoding.EncodeToString(hostKey.PublicKey().Marshal())
		byt, err := json.Marshal(resp)
		if err != nil {
			log.WithError(err).Error("cannot marshal response")
			return
		}
		w.Header().Add("Content-Type", "application/json")
		w.Write(byt)
	})
}

var websocketCloseErrorPattern = regexp.MustCompile(`websocket: close (\d+)`)

func extractCloseErrorCode(errStr string) string {
	matches := websocketCloseErrorPattern.FindStringSubmatch(errStr)
	if len(matches) < 2 {
		return "unknown"
	}

	return matches[1]
}

func (ir *ideRoutes) HandleSSHOverWebsocketTunnel(route *mux.Route, sshGatewayServer *sshproxy.Server) {
	r := route.Subrouter()
	r.Use(logRouteHandlerHandler("HandleSSHOverWebsocketTunnel"))
	r.Use(ir.Config.CorsHandler)
	r.Use(ir.workspaceMustExistHandler)
	r.Use(ir.Config.WorkspaceAuthHandler)

	r.NewRoute().HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var err error
		sshproxy.SSHTunnelOpenedTotal.WithLabelValues().Inc()
		defer func() {
			code := "unknown"
			if err != nil {
				code = extractCloseErrorCode(err.Error())
			}
			sshproxy.SSHTunnelClosedTotal.WithLabelValues(code).Inc()
		}()
		startTime := time.Now()
		log := log.WithField("userAgent", r.Header.Get("user-agent")).WithField("remoteAddr", r.RemoteAddr)

		upgrader := websocket.Upgrader{}
		wsConn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.WithError(err).Error("tunnel ssh: upgrade to the WebSocket protocol failed")
			return
		}
		coords := getWorkspaceCoords(r)
		infomap := make(map[string]string)
		infomap[common.WorkspaceIDIdentifier] = coords.ID
		infomap[common.DebugWorkspaceIdentifier] = strconv.FormatBool(coords.Debug)
		ctx := context.WithValue(r.Context(), common.WorkspaceInfoIdentifier, infomap)
		conn, err := gitpod.NewWebsocketConnection(ctx, wsConn, func(staleErr error) {
			log.WithError(staleErr).Error("tunnel ssh: closing stale connection")
		})
		if err != nil {
			log.WithError(err).Error("tunnel ssh: upgrade to the WebSocket protocol failed")
			return
		}
		log.Debugf("tunnel ssh: Connected from %s", conn.RemoteAddr())
		sshGatewayServer.HandleConn(conn)
		log.WithField("duration", time.Since(startTime).Seconds()).Debugf("tunnel ssh: Disconnect from %s", conn.RemoteAddr())
	})
}

func (ir *ideRoutes) HandleDirectSupervisorRoute(route *mux.Route, authenticated bool) {
	r := route.Subrouter()
	r.Use(logRouteHandlerHandler(fmt.Sprintf("HandleDirectSupervisorRoute (authenticated: %v)", authenticated)))
	r.Use(ir.Config.CorsHandler)
	r.Use(ir.workspaceMustExistHandler)
	if authenticated {
		r.Use(ir.Config.WorkspaceAuthHandler)
	}

	r.NewRoute().HandlerFunc(proxyPass(ir.Config, ir.InfoProvider, workspacePodSupervisorResolver))
}

func (ir *ideRoutes) HandleSupervisorFrontendRoute(route *mux.Route) {
	if ir.Config.Config.BlobServer == nil {
		// if we don't have blobserve, we serve the supervisor frontend from supervisor directly
		ir.HandleDirectSupervisorRoute(route, false)
		return
	}

	r := route.Subrouter()
	r.Use(logRouteHandlerHandler("SupervisorIDEHostHandler"))
	r.Use(ir.workspaceMustExistHandler)
	// strip the frontend prefix, just for good measure
	r.Use(func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
			req.URL.Path = strings.TrimPrefix(req.URL.Path, "/_supervisor/frontend")
			h.ServeHTTP(resp, req)
		})
	})
	// always hit the blobserver to ensure that blob is downloaded
	r.NewRoute().HandlerFunc(proxyPass(ir.Config, ir.InfoProvider, func(cfg *Config, infoProvider common.WorkspaceInfoProvider, req *http.Request) (*url.URL, error) {
		info := getWorkspaceInfoFromContext(req.Context())
		return resolveSupervisorURL(cfg, info, req)
	}, func(h *proxyPassConfig) {
		h.Transport = &blobserveTransport{
			transport: h.Transport,
			Config:    ir.Config.Config,
			resolveImage: func(t *blobserveTransport, req *http.Request) string {
				info := getWorkspaceInfoFromContext(req.Context())
				if info == nil && len(ir.Config.Config.WorkspacePodConfig.SupervisorImage) == 0 {
					// no workspace information available - cannot resolve supervisor image
					return ""
				}

				// use the config value for backwards compatibility when info.SupervisorImage is not set
				image := ir.Config.Config.WorkspacePodConfig.SupervisorImage
				if info != nil && len(info.SupervisorImage) > 0 {
					image = info.SupervisorImage
				}

				path := strings.TrimPrefix(req.URL.Path, "/"+image)
				if path == "/worker-proxy.js" {
					// worker must be served from the same origin
					return ""
				}
				return image
			},
		}
	}, withUseTargetHost()))
}

func resolveSupervisorURL(cfg *Config, info *common.WorkspaceInfo, req *http.Request) (*url.URL, error) {
	if info == nil && len(cfg.WorkspacePodConfig.SupervisorImage) == 0 {
		log.WithFields(log.OWI("", getWorkspaceCoords(req).ID, "")).Warn("no workspace info available - cannot resolve supervisor route")
		return nil, xerrors.Errorf("no workspace information available - cannot resolve supervisor route")
	}

	// use the config value for backwards compatibility when info.SupervisorImage is not set
	supervisorImage := cfg.WorkspacePodConfig.SupervisorImage
	if info != nil && len(info.SupervisorImage) > 0 {
		supervisorImage = info.SupervisorImage
	}

	var dst url.URL
	dst.Scheme = cfg.BlobServer.Scheme
	dst.Host = cfg.BlobServer.Host
	dst.Path = cfg.BlobServer.PathPrefix + "/" + supervisorImage
	return &dst, nil
}

type BlobserveInlineVars struct {
	IDE             string `json:"ide"`
	SupervisorImage string `json:"supervisor"`
}

func (ir *ideRoutes) HandleRoot(route *mux.Route) {
	r := route.Subrouter()
	r.Use(logRouteHandlerHandler("handleRoot"))
	r.Use(ir.Config.CorsHandler)
	r.Use(ir.workspaceMustExistHandler)

	directIDEPass := ir.Config.WorkspaceAuthHandler(
		proxyPass(ir.Config, ir.InfoProvider, workspacePodResolver),
	)
	// always hit the blobserver to ensure that blob is downloaded
	r.NewRoute().HandlerFunc(proxyPass(ir.Config, ir.InfoProvider, dynamicIDEResolver, func(h *proxyPassConfig) {
		h.Transport = &blobserveTransport{
			transport: h.Transport,
			Config:    ir.Config.Config,
			resolveImage: func(t *blobserveTransport, req *http.Request) string {
				info := getWorkspaceInfoFromContext(req.Context())
				if info == nil {
					// no workspace information available - cannot resolve IDE image and path
					return ""
				}
				image := info.IDEImage
				imagePath := strings.TrimPrefix(req.URL.Path, t.Config.BlobServer.PathPrefix+"/"+image)
				if imagePath != "/index.html" && imagePath != "/" {
					return image
				}
				// blobserve can inline static links in index.html for IDE and supervisor to avoid redirects for each resource
				// but it has to know exposed URLs in the context of current workspace cluster
				// so first we ask blobserve to preload the supervisor image
				// and if it is successful we pass exposed URLs to IDE and supervisor to blobserve for inlining
				supervisorURL, err := resolveSupervisorURL(t.Config, info, req)
				if err != nil {
					log.WithError(err).Error("could not preload supervisor")
					return image
				}
				supervisorURLString := supervisorURL.String() + "/main.js"
				preloadSupervisorReq, err := http.NewRequest("HEAD", supervisorURLString, nil)
				if err != nil {
					log.WithField("supervisorURL", supervisorURL).WithError(err).Error("could not preload supervisor")
					return image
				}
				resp, err := t.DoRoundTrip(preloadSupervisorReq)
				if err != nil {
					log.WithField("supervisorURL", supervisorURL).WithError(err).Error("could not preload supervisor")
					return image
				}
				_ = resp.Body.Close()
				if resp.StatusCode != http.StatusOK {
					log.WithField("supervisorURL", supervisorURL).WithField("statusCode", resp.StatusCode).WithField("status", resp.Status).Error("could not preload supervisor")
					return image
				}

				// use the config value for backwards compatibility when info.SupervisorImage is not set
				supervisorImage := t.Config.WorkspacePodConfig.SupervisorImage
				if len(info.SupervisorImage) > 0 {
					supervisorImage = info.SupervisorImage
				}

				inlineVars := &BlobserveInlineVars{
					IDE:             t.asBlobserveURL(image, ""),
					SupervisorImage: t.asBlobserveURL(supervisorImage, ""),
				}
				inlinveVarsValue, err := json.Marshal(inlineVars)
				if err != nil {
					log.WithError(err).WithField("inlineVars", inlineVars).Error("could no serialize inline vars")
					return image
				}

				req.Header.Add("X-BlobServe-InlineVars", string(inlinveVarsValue))
				return image
			},
		}
	}, withHTTPErrorHandler(directIDEPass), withUseTargetHost()))
}

func installForeignRoutes(r *mux.Router, config *RouteHandlerConfig, infoProvider common.WorkspaceInfoProvider) error {
	err := installWorkspacePortRoutes(r.MatcherFunc(func(r *http.Request, rm *mux.RouteMatch) bool {
		workspacePathPrefix := rm.Vars[common.WorkspacePathPrefixIdentifier]
		if workspacePathPrefix == "" || rm.Vars[common.WorkspacePortIdentifier] == "" {
			return false
		}
		r.URL.Path = strings.TrimPrefix(r.URL.Path, workspacePathPrefix)
		return true
	}).Subrouter(), config, infoProvider)
	if err != nil {
		return err
	}
	err = installDebugWorkspaceRoutes(r.MatcherFunc(func(r *http.Request, rm *mux.RouteMatch) bool {
		workspacePathPrefix := rm.Vars[common.WorkspacePathPrefixIdentifier]
		if workspacePathPrefix == "" || rm.Vars[common.DebugWorkspaceIdentifier] != "true" {
			return false
		}
		r.URL.Path = strings.TrimPrefix(r.URL.Path, workspacePathPrefix)
		return true
	}).Subrouter(), config, infoProvider)
	if err != nil {
		return err
	}
	installBlobserveRoutes(r.NewRoute().Subrouter(), config, infoProvider)
	return nil
}

const imagePathSeparator = "/__files__"

// installBlobserveRoutes  implements long-lived caching with versioned URLs, see https://web.dev/http-cache/#versioned-urls
func installBlobserveRoutes(r *mux.Router, config *RouteHandlerConfig, infoProvider common.WorkspaceInfoProvider) {
	r.Use(logHandler)
	r.Use(logRouteHandlerHandler("BlobserveRootHandler"))

	targetResolver := func(cfg *Config, infoProvider common.WorkspaceInfoProvider, req *http.Request) (tgt *url.URL, err error) {
		segments := strings.SplitN(req.URL.Path, imagePathSeparator, 2)
		if len(segments) < 2 {
			return nil, xerrors.Errorf("invalid URL")
		}
		image, path := segments[0], segments[1]

		req.URL.Path = path

		var dst url.URL
		dst.Scheme = cfg.BlobServer.Scheme
		dst.Host = cfg.BlobServer.Host
		dst.Path = cfg.BlobServer.PathPrefix + "/" + strings.TrimPrefix(image, "/")
		return &dst, nil
	}
	r.NewRoute().Handler(proxyPass(config, infoProvider, targetResolver, withLongTermCaching(), withUseTargetHost()))
}

// installDebugWorkspaceRoutes configures for debug workspace.
func installDebugWorkspaceRoutes(r *mux.Router, config *RouteHandlerConfig, infoProvider common.WorkspaceInfoProvider) error {
	showPortNotFoundPage, err := servePortNotFoundPage(config.Config)
	if err != nil {
		return err
	}

	r.Use(logHandler)
	r.Use(config.CorsHandler)
	r.Use(config.WorkspaceAuthHandler)
	// filter all session cookies
	r.Use(sensitiveCookieHandler(config.Config.GitpodInstallation.HostName))
	r.NewRoute().HandlerFunc(proxyPass(config, infoProvider, workspacePodResolver, withHTTPErrorHandler(showPortNotFoundPage)))
	return nil
}

// installWorkspacePortRoutes configures routing for exposed ports.
func installWorkspacePortRoutes(r *mux.Router, config *RouteHandlerConfig, infoProvider common.WorkspaceInfoProvider) error {
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
		func(rw http.ResponseWriter, r *http.Request) {
			// a work-around for servers which does not respect case-insensitive headers, see https://github.com/gitpod-io/gitpod/issues/4047#issuecomment-856566526
			for _, name := range []string{"Key", "Extensions", "Accept", "Protocol", "Version"} {
				values := r.Header["Sec-Websocket-"+name]
				if len(values) != 0 {
					r.Header.Del("Sec-Websocket-" + name)
					r.Header["Sec-WebSocket-"+name] = values
				}
			}
			r.Header.Add("X-Forwarded-Proto", "https")
			r.Header.Add("X-Forwarded-Host", r.Host)
			r.Header.Add("X-Forwarded-Port", "443")

			coords := getWorkspaceCoords(r)
			if coords.Debug {
				r.Header.Add("X-WS-Proxy-Debug-Port", coords.Port)
			}

			proxyPass(
				config,
				infoProvider,
				workspacePodPortResolver,
				withHTTPErrorHandler(showPortNotFoundPage),
				withXFrameOptionsFilter(),
				func(h *proxyPassConfig) {
					h.Transport = &http.Transport{
						TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
					}
				},
			)(rw, r)
		},
	)

	return nil
}

// workspacePodResolver resolves to the workspace pod's url from the given request.
func workspacePodResolver(config *Config, infoProvider common.WorkspaceInfoProvider, req *http.Request) (url *url.URL, err error) {
	coords := getWorkspaceCoords(req)
	var port string
	if coords.Debug {
		port = fmt.Sprint(config.WorkspacePodConfig.IDEDebugPort)
	} else {
		port = fmt.Sprint(config.WorkspacePodConfig.TheiaPort)
	}
	workspaceInfo := infoProvider.WorkspaceInfo(coords.ID)
	return buildWorkspacePodURL(api.PortProtocol_PORT_PROTOCOL_HTTP, workspaceInfo.IPAddress, port)
}

// workspacePodPortResolver resolves to the workspace pods ports.
func workspacePodPortResolver(config *Config, infoProvider common.WorkspaceInfoProvider, req *http.Request) (url *url.URL, err error) {
	coords := getWorkspaceCoords(req)
	workspaceInfo := infoProvider.WorkspaceInfo(coords.ID)
	var port string
	protocol := api.PortProtocol_PORT_PROTOCOL_HTTP
	if coords.Debug {
		port = fmt.Sprint(config.WorkspacePodConfig.DebugWorkspaceProxyPort)
	} else {
		port = coords.Port
		prt, err := strconv.ParseUint(port, 10, 16)
		if err != nil {
			log.WithField("port", port).WithError(err).Error("cannot convert port to int")
		} else {
			for _, p := range workspaceInfo.Ports {
				if p.Port == uint32(prt) {
					protocol = p.Protocol
					break
				}
			}
		}
	}
	return buildWorkspacePodURL(protocol, workspaceInfo.IPAddress, port)
}

// workspacePodSupervisorResolver resolves to the workspace pods Supervisor url from the given request.
func workspacePodSupervisorResolver(config *Config, infoProvider common.WorkspaceInfoProvider, req *http.Request) (url *url.URL, err error) {
	coords := getWorkspaceCoords(req)
	var port string
	if coords.Debug {
		port = fmt.Sprint(config.WorkspacePodConfig.SupervisorDebugPort)
	} else {
		port = fmt.Sprint(config.WorkspacePodConfig.SupervisorPort)
	}
	workspaceInfo := infoProvider.WorkspaceInfo(coords.ID)
	return buildWorkspacePodURL(api.PortProtocol_PORT_PROTOCOL_HTTP, workspaceInfo.IPAddress, port)
}

func dynamicIDEResolver(config *Config, infoProvider common.WorkspaceInfoProvider, req *http.Request) (res *url.URL, err error) {
	info := getWorkspaceInfoFromContext(req.Context())
	if info == nil {
		log.WithFields(log.OWI("", getWorkspaceCoords(req).ID, "")).Warn("no workspace info available - cannot resolve Theia route")
		return nil, xerrors.Errorf("no workspace information available - cannot resolve Theia route")
	}

	var dst url.URL
	dst.Scheme = config.BlobServer.Scheme
	dst.Host = config.BlobServer.Host
	dst.Path = config.BlobServer.PathPrefix + "/" + info.IDEImage

	return &dst, nil
}

func buildWorkspacePodURL(protocol api.PortProtocol, ipAddress string, port string) (*url.URL, error) {
	portProtocol := ""
	switch protocol {
	case api.PortProtocol_PORT_PROTOCOL_HTTP:
		portProtocol = "http"
	case api.PortProtocol_PORT_PROTOCOL_HTTPS:
		portProtocol = "https"
	default:
		return nil, xerrors.Errorf("protocol not supported")
	}
	return url.Parse(fmt.Sprintf("%v://%v:%v", portProtocol, ipAddress, port))
}

// corsHandler produces the CORS handler for workspaces.
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
			wsID = vars[common.WorkspaceIDIdentifier]
			port = vars[common.WorkspacePortIdentifier]
		)
		entry := logrus.Fields{
			"workspaceId": wsID,
			"portID":      port,
			"url":         req.URL.String(),
		}
		ctx := context.WithValue(req.Context(), logContextValueKey, entry)
		req = req.WithContext(ctx)

		h.ServeHTTP(resp, req)
	})
}

func logRouteHandlerHandler(routeHandlerName string) mux.MiddlewareFunc {
	return func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
			getLog(req.Context()).WithField("routeHandler", routeHandlerName).Debug("hit route handler")
			h.ServeHTTP(resp, req)
		})
	}
}

func getLog(ctx context.Context) *logrus.Entry {
	r := ctx.Value(logContextValueKey)
	rl, ok := r.(logrus.Fields)
	if rl == nil || !ok {
		return log.Log
	}

	return log.WithFields(rl)
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
func workspaceMustExistHandler(config *Config, infoProvider common.WorkspaceInfoProvider) mux.MiddlewareFunc {
	return func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(resp http.ResponseWriter, req *http.Request) {
			coords := getWorkspaceCoords(req)
			info := infoProvider.WorkspaceInfo(coords.ID)
			if info == nil {
				redirectURL := fmt.Sprintf("%s://%s/start/?not_found=true#%s", config.GitpodInstallation.Scheme, config.GitpodInstallation.HostName, coords.ID)
				http.Redirect(resp, req, redirectURL, http.StatusFound)
				return
			}

			h.ServeHTTP(resp, req.WithContext(context.WithValue(req.Context(), infoContextValueKey, info)))
		})
	}
}

// getWorkspaceInfoFromContext retrieves workspace information put there by the workspaceMustExistHandler.
func getWorkspaceInfoFromContext(ctx context.Context) *common.WorkspaceInfo {
	r := ctx.Value(infoContextValueKey)
	rl, ok := r.(*common.WorkspaceInfo)
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
		if strings.HasPrefix(c.Name, hostnamePrefix) {
			// skip session cookie
			continue
		}
		log.WithField("hostnamePrefix", hostnamePrefix).WithField("name", c.Name).Debug("keeping cookie")
		cookies[n] = c
		n++
	}
	return cookies[:n]
}

// region blobserve transport.
type blobserveTransport struct {
	transport    http.RoundTripper
	Config       *Config
	resolveImage func(t *blobserveTransport, req *http.Request) string
}

func (t *blobserveTransport) DoRoundTrip(req *http.Request) (resp *http.Response, err error) {
	for i := 0; i < 5; i++ {
		resp, err = t.transport.RoundTrip(req)
		if err != nil {
			return nil, err
		}

		if resp.StatusCode >= http.StatusBadRequest {
			respBody, err := io.ReadAll(resp.Body)
			if err != nil {
				return nil, err
			}
			_ = resp.Body.Close()

			if resp.StatusCode == http.StatusServiceUnavailable && string(respBody) == "timeout" {
				// on timeout try again till the client request is cancelled
				// blob server sometimes takes time to pull a new image
				continue
			}

			// treat any client or server error code as a http error
			return nil, xerrors.Errorf("blobserver error: (%d) %s", resp.StatusCode, string(respBody))
		}
		break
	}
	return resp, err
}

func isWebSocketUpgrade(req *http.Request) bool {
	return strings.EqualFold(req.Header.Get("Upgrade"), "websocket") &&
		strings.Contains(strings.ToLower(req.Header.Get("Connection")), "upgrade")
}

func (t *blobserveTransport) RoundTrip(req *http.Request) (resp *http.Response, err error) {
	if isWebSocketUpgrade(req) {
		return nil, xerrors.Errorf("blobserve: websocket not supported")
	}

	image := t.resolveImage(t, req)

	resp, err = t.DoRoundTrip(req)
	if err != nil {
		return nil, err
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

	if image == "" {
		return resp, nil
	}

	_ = resp.Body.Close()
	return t.redirect(image, req)
}

func (t *blobserveTransport) redirect(image string, req *http.Request) (*http.Response, error) {
	path := strings.TrimPrefix(req.URL.Path, t.Config.BlobServer.PathPrefix+"/"+image)
	location := t.asBlobserveURL(image, path)

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

func (t *blobserveTransport) asBlobserveURL(image string, path string) string {
	return fmt.Sprintf("%s://ide.%s/blobserve/%s%s%s",
		t.Config.GitpodInstallation.Scheme,
		t.Config.GitpodInstallation.HostName,
		image,
		imagePathSeparator,
		path,
	)
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
		_, _ = w.Write(page)
	}), nil
}
