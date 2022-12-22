// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"net/http"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/gorilla/mux"

	"github.com/gitpod-io/gitpod/common-go/log"
)

const (
	// Used as key for storing the workspace port in the requests mux.Vars() map.
	workspacePortIdentifier = "workspacePort"

	// Used as key for storing the workspace ID in the requests mux.Vars() map.
	workspaceIDIdentifier = "workspaceID"

	// The header that is used to communicate the "Host" from proxy -> ws-proxy in scenarios where ws-proxy is _not_ directly exposed.
	forwardedHostnameHeader = "x-wsproxy-host"

	// This pattern matches v4 UUIDs as well as the new generated workspace ids (e.g. pink-panda-ns35kd21).
	workspaceIDRegex   = "(?P<" + workspaceIDIdentifier + ">[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-z]{2,16}-[0-9a-z]{2,16}-[0-9a-z]{8,11})"
	workspacePortRegex = "(?P<" + workspacePortIdentifier + ">[0-9]+)-"

	debugWorkspaceIdentifier = "debugWorkspace"
	debugWorkspaceRegex      = "(?P<" + debugWorkspaceIdentifier + ">debug-)?"

	workspacePathPrefixIdentifier = "workspacePathPrefix"
)

// WorkspaceRouter is a function that configures subrouters (one for theia, one for the exposed ports) on the given router
// which resolve workspace coordinates (ID, port?) from each request. The contract is to store those in the request's mux.Vars
// with the keys workspacePortIdentifier and workspaceIDIdentifier.
type WorkspaceRouter func(r *mux.Router, wsInfoProvider WorkspaceInfoProvider) (ideRouter *mux.Router, portRouter *mux.Router, blobserveRouter *mux.Router)

// HostBasedRouter is a WorkspaceRouter that routes simply based on the "Host" header.
func HostBasedRouter(header, wsHostSuffix string, wsHostSuffixRegex string) WorkspaceRouter {
	return func(r *mux.Router, wsInfoProvider WorkspaceInfoProvider) (*mux.Router, *mux.Router, *mux.Router) {
		allClusterWsHostSuffixRegex := wsHostSuffixRegex
		if allClusterWsHostSuffixRegex == "" {
			allClusterWsHostSuffixRegex = wsHostSuffix
		}

		// make sure acme router is the first handler setup to make sure it has a chance to catch acme challenge
		setupAcmeRouter(r)

		var (
			getHostHeader = func(req *http.Request) string {
				host := req.Header.Get(header)
				// if we don't get host from special header, fallback to use req.Host
				if header == "Host" || host == "" {
					parts := strings.Split(req.Host, ":")
					return parts[0]
				}
				return host
			}
			foreignRouter = r.MatcherFunc(matchForeignHostHeader(wsHostSuffix, getHostHeader)).Subrouter()
			portRouter    = r.MatcherFunc(matchWorkspaceHostHeader(wsHostSuffix, getHostHeader, true)).Subrouter()
			ideRouter     = r.MatcherFunc(matchWorkspaceHostHeader(allClusterWsHostSuffixRegex, getHostHeader, false)).Subrouter()
		)

		r.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			hostname := getHostHeader(req)
			log.Debugf("no match for path %s, host: %s", req.URL.Path, hostname)
			w.WriteHeader(http.StatusNotFound)
		})
		return ideRouter, portRouter, foreignRouter
	}
}

type hostHeaderProvider func(req *http.Request) string

func matchWorkspaceHostHeader(wsHostSuffix string, headerProvider hostHeaderProvider, matchPort bool) mux.MatcherFunc {
	var regexPrefix string
	if matchPort {
		regexPrefix = workspacePortRegex + workspaceIDRegex
	} else {
		regexPrefix = debugWorkspaceRegex + workspaceIDRegex
	}

	r := regexp.MustCompile("^" + regexPrefix + wsHostSuffix)

	return func(req *http.Request, m *mux.RouteMatch) bool {
		hostname := headerProvider(req)
		if hostname == "" {
			return false
		}

		var workspaceID, workspacePort, debugWorkspace string
		matches := r.FindStringSubmatch(hostname)
		if len(matches) < 3 {
			return false
		}
		if matchPort {
			// https://3000-coral-dragon-ilr0r6eq.ws-eu10.gitpod.io/index.html
			// debugWorkspace:
			// workspaceID: coral-dragon-ilr0r6eq
			// workspacePort: 3000
			workspaceID = matches[2]
			workspacePort = matches[1]
		} else {
			// https://debug-coral-dragon-ilr0r6eq.ws-eu10.gitpod.io/index.html
			// debugWorkspace: true
			// workspaceID: coral-dragon-ilr0r6eq
			// workspacePort:
			if matches[1] != "" {
				debugWorkspace = "true"
			}

			// https://coral-dragon-ilr0r6eq.ws-eu10.gitpod.io/index.html
			// debugWorkspace:
			// workspaceID: coral-dragon-ilr0r6eq
			// workspacePort:
			workspaceID = matches[2]
		}

		if workspaceID == "" {
			return false
		}

		if matchPort && workspacePort == "" {
			return false
		}

		if m.Vars == nil {
			m.Vars = make(map[string]string)
		}
		m.Vars[workspaceIDIdentifier] = workspaceID
		if workspacePort != "" {
			m.Vars[workspacePortIdentifier] = workspacePort
		}
		if debugWorkspace != "" {
			m.Vars[debugWorkspaceIdentifier] = debugWorkspace
		}

		return true
	}
}

func matchForeignHostHeader(wsHostSuffix string, headerProvider hostHeaderProvider) mux.MatcherFunc {
	pathPortRegex := regexp.MustCompile("^/" + workspacePortRegex + workspaceIDRegex + "/")
	pathDebugRegex := regexp.MustCompile("^/" + debugWorkspaceRegex + workspaceIDRegex + "/")

	r := regexp.MustCompile("^(?:v--)?[0-9a-v]+" + wsHostSuffix)
	return func(req *http.Request, m *mux.RouteMatch) bool {
		hostname := headerProvider(req)
		if hostname == "" {
			return false
		}

		matches := r.FindStringSubmatch(hostname)
		if len(matches) < 1 {
			return false
		}
		matches = pathPortRegex.FindStringSubmatch(req.URL.Path)
		if len(matches) < 3 {
			matches = pathDebugRegex.FindStringSubmatch(req.URL.Path)
		}
		if len(matches) < 3 {
			return true
		}

		if m.Vars == nil {
			m.Vars = make(map[string]string)
		}
		m.Vars[workspacePathPrefixIdentifier] = strings.TrimRight(matches[0], "/")
		m.Vars[workspaceIDIdentifier] = matches[2]
		if matches[1] == "debug-" {
			m.Vars[debugWorkspaceIdentifier] = "true"
		} else {
			m.Vars[workspacePortIdentifier] = matches[1]
		}

		return true
	}
}

func getWorkspaceCoords(req *http.Request) WorkspaceCoords {
	vars := mux.Vars(req)
	return WorkspaceCoords{
		ID:    vars[workspaceIDIdentifier],
		Port:  vars[workspacePortIdentifier],
		Debug: vars[debugWorkspaceIdentifier] == "true",
	}
}

func isAcmeChallenge(path string) bool {
	return strings.HasPrefix(filepath.Clean(path), "/.well-known/acme-challenge/")
}

func matchAcmeChallenge() mux.MatcherFunc {
	return func(req *http.Request, m *mux.RouteMatch) bool {
		return isAcmeChallenge(req.URL.Path)
	}
}

func setupAcmeRouter(router *mux.Router) {
	router.MatcherFunc(matchAcmeChallenge()).HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		log.Debugf("ACME challenge found for path %s, host: %s", req.URL.Path, req.Host)
		w.WriteHeader(http.StatusForbidden)
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	})
}
