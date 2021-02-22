// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gorilla/mux"
	"golang.org/x/xerrors"
)

const (
	// Used as key for storing the workspace port in the requests mux.Vars() map
	workspacePortIdentifier = "workspacePort"

	// Used as key for storing the workspace ID in the requests mux.Vars() map
	workspaceIDIdentifier = "workspaceID"

	// Used as key for storing the origin prefix to fetch foreign content
	foreignOriginPrefix = "foreignOriginPrefix"

	// The header that is used to communicate the "Host" from proxy -> ws-proxy in scenarios where ws-proxy is _not_ directly exposed
	forwardedHostnameHeader = "x-wsproxy-host"

	// Used to communicate router error happening in the matcher with the error handler which set the code to the HTTP response
	routerErrorCode = "routerErrorCode"

	// This pattern matches v4 UUIDs as well as the new generated workspace ids (e.g. pink-panda-ns35kd21)
	workspaceIDRegex   = "(?P<" + workspaceIDIdentifier + ">[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-z]{2,16}-[0-9a-z]{2,16}-[0-9a-z]{8})"
	workspacePortRegex = "(?P<" + workspacePortIdentifier + ">[0-9]+)-"
)

// WorkspaceRouter is a function that configures subrouters (one for theia, one for the exposed ports) on the given router
// which resolve workspace coordinates (ID, port?) from each request. The contract is to store those in the request's mux.Vars
// with the keys workspacePortIdentifier and workspaceIDIdentifier
type WorkspaceRouter func(r *mux.Router, wsInfoProvider WorkspaceInfoProvider) (theiaRouter *mux.Router, portRouter *mux.Router, blobserveRouter *mux.Router)

// HostBasedRouter is a WorkspaceRouter that routes simply based on the "Host" header
func HostBasedRouter(header, wsHostSuffix string) WorkspaceRouter {
	return func(r *mux.Router, wsInfoProvider WorkspaceInfoProvider) (*mux.Router, *mux.Router, *mux.Router) {
		var (
			getHostHeader   = func(req *http.Request) string { return req.Header.Get(header) }
			blobserveRouter = r.MatcherFunc(matchBlobserveHostHeader(wsHostSuffix, getHostHeader)).Subrouter()
			portRouter      = r.MatcherFunc(matchWorkspacePortHostHeader(wsHostSuffix, getHostHeader)).Subrouter()
			theiaRouter     = r.MatcherFunc(matchWorkspaceHostHeader(wsHostSuffix, getHostHeader)).Subrouter()
		)

		r.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			hostname := getHostHeader(req)
			log.Debugf("no match for path %s, host: %s", req.URL.Path, hostname)
			w.WriteHeader(404)
		})
		return theiaRouter, portRouter, blobserveRouter
	}
}

type hostHeaderProvider func(req *http.Request) string

func matchWorkspaceHostHeader(wsHostSuffix string, headerProvider hostHeaderProvider) mux.MatcherFunc {
	r := regexp.MustCompile("^(webview-|browser-|extensions-)?" + workspaceIDRegex + wsHostSuffix)
	return func(req *http.Request, m *mux.RouteMatch) bool {
		hostname := headerProvider(req)
		if hostname == "" {
			return false
		}

		matches := r.FindStringSubmatch(hostname)
		if len(matches) < 3 {
			return false
		}

		workspaceID := matches[2]
		if workspaceID == "" {
			return false
		}

		if m.Vars == nil {
			m.Vars = make(map[string]string)
		}
		m.Vars[workspaceIDIdentifier] = workspaceID
		if len(matches) == 3 {
			m.Vars[foreignOriginPrefix] = matches[1]
		}
		return true
	}
}

func matchWorkspacePortHostHeader(wsHostSuffix string, headerProvider hostHeaderProvider) mux.MatcherFunc {
	r := regexp.MustCompile("^(webview-|browser-|extensions-)?" + workspacePortRegex + workspaceIDRegex + wsHostSuffix)
	return func(req *http.Request, m *mux.RouteMatch) bool {
		hostname := headerProvider(req)
		if hostname == "" {
			return false
		}

		matches := r.FindStringSubmatch(hostname)
		if len(matches) < 4 {
			return false
		}

		workspaceID := matches[3]
		if workspaceID == "" {
			return false
		}

		workspacePort := matches[2]
		if workspacePort == "" {
			return false
		}

		if m.Vars == nil {
			m.Vars = make(map[string]string)
		}
		m.Vars[workspaceIDIdentifier] = workspaceID
		m.Vars[workspacePortIdentifier] = workspacePort
		if len(matches) == 4 {
			m.Vars[foreignOriginPrefix] = matches[1]
		}
		return true
	}
}

func matchBlobserveHostHeader(wsHostSuffix string, headerProvider hostHeaderProvider) mux.MatcherFunc {
	r := regexp.MustCompile("^blobserve" + wsHostSuffix)
	return func(req *http.Request, m *mux.RouteMatch) bool {
		hostname := headerProvider(req)
		if hostname == "" {
			return false
		}

		matches := r.FindStringSubmatch(hostname)
		if len(matches) < 1 {
			return false
		}

		return true
	}
}

// PortBasedRouter is a WorkspaceRouter which handles port-based ingress to workspaces
func portBasedRouter(r *mux.Router, wsInfoProvider WorkspaceInfoProvider, routePorts bool) *mux.Router {
	// sadly using middleware does not work here because it is executed _after_ matchers, so we resort to applying workspace coords in the matcher
	matchWorkspaceCoords := func(req *http.Request, m *mux.RouteMatch) bool {
		if m.Vars == nil {
			m.Vars = make(map[string]string)
		}
		publicPort, err := getPublicPortFromPortReq(req)
		if err != nil {
			log.Error(err)
			m.Vars[routerErrorCode] = "502"
			return false
		}

		coords := wsInfoProvider.WorkspaceCoords(publicPort)
		if coords == nil {
			log.Debugf("no match for port request to: '%s' (host), '%s' (url)", req.Host, req.URL.String())
			m.Vars[routerErrorCode] = "404"
			return false
		}
		m.Vars[workspaceIDIdentifier] = coords.ID
		if coords.Port != "" {
			m.Vars[workspacePortIdentifier] = coords.Port
		}

		if coords.ID == "" {
			return false
		}

		if routePorts {
			return coords.Port != ""
		}

		return true
	}

	// as we can not respond from within the matcher itself we handle resolve errors like this:
	//  1. write error codes to vars(req)
	//	2. rely on matcher mismatching
	//	3. respond with router error from NotFoundHandler
	r.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		codeStr := vars[routerErrorCode]
		if codeStr == "" {
			log.Debugf("unable to resolve port request to: %s", req.URL.String())
			return
		}
		code, err := strconv.Atoi(codeStr)
		if err != nil {
			w.WriteHeader(502)
			return
		}
		w.WriteHeader(code)
	})

	return r.MatcherFunc(matchWorkspaceCoords).Subrouter()
}

// getPublicPortFromPortReq extracts the public port from requests to "exposed ports"
func getPublicPortFromPortReq(req *http.Request) (string, error) {
	parts := strings.SplitN(req.Host, ":", 2)
	if len(parts) == 0 {
		return "", xerrors.Errorf("request without proper host: %s", req.Host)
	} else if len(parts) == 1 {
		// only hostname, no port specified:
		return "", xerrors.Errorf("request without explicit port: %s", req.Host)
	} else if len(parts) == 2 {
		// "regular" <host>:<port>
		return parts[1], nil
	}
	return "", xerrors.Errorf("request without proper host: %s", req.Host)
}

func getWorkspaceCoords(req *http.Request) WorkspaceCoords {
	vars := mux.Vars(req)
	return WorkspaceCoords{
		ID:   vars[workspaceIDIdentifier],
		Port: vars[workspacePortIdentifier],
	}
}

// PathBasedTheiaRouter routes workspaces using a /workspaceID prefix.
// Doesn't do port routing.
func pathBasedTheiaRouter(r *mux.Router, wsInfoProvider WorkspaceInfoProvider, trimPrefix string) *mux.Router {
	if trimPrefix == "" {
		trimPrefix = "/"
	}
	trimPrefix = strings.TrimSuffix(trimPrefix, "/") + "/"

	prefixedWorkspaceIDRegex := regexp.MustCompile("^(" + trimPrefix + ")" + workspaceIDRegex)
	return r.MatcherFunc(func(req *http.Request, match *mux.RouteMatch) (res bool) {

		var wsID string
		defer func() {
			log.WithField("workspaceId", wsID).WithField("matches", res).WithField("URL", req.URL.String()).Debug("PathBasedTheiaRouter")

			if !res || wsID == "" {
				return
			}

			req.URL.Path = strings.TrimPrefix(req.URL.Path, trimPrefix+wsID)
			if req.URL.Path == "" {
				req.URL.Path = "/"
			}
		}()

		var ok bool
		if wsID, ok = match.Vars[workspaceIDIdentifier]; ok {
			return true
		}

		matches := prefixedWorkspaceIDRegex.FindStringSubmatch(req.URL.Path)
		if len(matches) < 3 {
			return false
		}

		wsID = matches[2]
		if wsID == "" {
			return false
		}

		if wsInfoProvider.WorkspaceInfo(req.Context(), wsID) == nil {
			log.WithFields(log.OWI("", wsID, "")).Debug("PathBasedTheiaRouter: no workspace info found")
			return false
		}

		match.Vars = map[string]string{
			workspaceIDIdentifier: wsID,
		}
		return true
	}).Subrouter()
}

func pathBasedBlobserveRouter(r *mux.Router) *mux.Router {
	return r.MatcherFunc(func(req *http.Request, match *mux.RouteMatch) (res bool) {
		if _, ok := match.Vars["blobserve"]; ok {
			return true
		}

		if !strings.HasPrefix(req.URL.Path, "/blobserve") {
			return false
		}

		req.URL.Path = strings.TrimPrefix(req.URL.Path, "/blobserve")
		if req.URL.Path == "" {
			req.URL.Path = "/"
		}

		if match.Vars == nil {
			match.Vars = make(map[string]string)
		}
		match.Vars["blobserve"] = "true"

		return true
	}).Subrouter()
}

// PathAndPortRouter routes workspace access using the URL's path (/wsid prefix) and port access using the request's port
func PathAndPortRouter(trimPrefix string) WorkspaceRouter {
	return func(r *mux.Router, wsInfoProvider WorkspaceInfoProvider) (theiaRouter *mux.Router, portRouter *mux.Router, blobserveRouter *mux.Router) {
		theiaRouter = pathBasedTheiaRouter(r, wsInfoProvider, trimPrefix)
		blobserveRouter = pathBasedBlobserveRouter(r)
		portRouter = portBasedRouter(r, wsInfoProvider, true)
		return
	}
}

// PathAndHostRouter routes workspace access using the URL's path (/wsid prefix) and port access using the Host header
func PathAndHostRouter(trimPrefix, header, wsHostSuffix string) WorkspaceRouter {
	return func(r *mux.Router, wsInfoProvider WorkspaceInfoProvider) (theiaRouter *mux.Router, portRouter *mux.Router, blobserveRouter *mux.Router) {
		theiaRouter = pathBasedTheiaRouter(r, wsInfoProvider, trimPrefix)
		blobserveRouter = pathBasedBlobserveRouter(r)
		_, portRouter, _ = HostBasedRouter(header, wsHostSuffix)(r, wsInfoProvider)
		return
	}
}
