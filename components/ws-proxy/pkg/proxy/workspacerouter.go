// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/gorilla/mux"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/log"
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
			getHostHeader = func(req *http.Request) string {
				if header == "Host" {
					parts := strings.Split(req.Host, ":")
					return parts[0]
				}

				return req.Header.Get(header)
			}
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
