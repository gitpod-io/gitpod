// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"net/http"
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

	// Used as key for storing the origin to fetch foreign content.
	foreignOriginIdentifier = "foreignOrigin"

	// Used as key for storing the path to fetch foreign content.
	foreignPathIdentifier = "foreignPath"

	// The header that is used to communicate the "Host" from proxy -> ws-proxy in scenarios where ws-proxy is _not_ directly exposed.
	forwardedHostnameHeader = "x-wsproxy-host"

	// This pattern matches v4 UUIDs as well as the new generated workspace ids (e.g. pink-panda-ns35kd21).
	workspaceIDRegex   = "(?P<" + workspaceIDIdentifier + ">[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-z]{2,16}-[0-9a-z]{2,16}-[0-9a-z]{8,11})"
	workspacePortRegex = "(?P<" + workspacePortIdentifier + ">[0-9]+)-"
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
			blobserveRouter = r.MatcherFunc(matchBlobserveHostHeader(wsHostSuffix, getHostHeader)).Subrouter()
			portRouter      = r.MatcherFunc(matchWorkspaceHostHeader(wsHostSuffix, getHostHeader, true)).Subrouter()
			ideRouter       = r.MatcherFunc(matchWorkspaceHostHeader(allClusterWsHostSuffixRegex, getHostHeader, false)).Subrouter()
		)

		r.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			hostname := getHostHeader(req)
			log.Debugf("no match for path %s, host: %s", req.URL.Path, hostname)
			w.WriteHeader(http.StatusNotFound)
		})
		return ideRouter, portRouter, blobserveRouter
	}
}

type hostHeaderProvider func(req *http.Request) string

func matchWorkspaceHostHeader(wsHostSuffix string, headerProvider hostHeaderProvider, matchPort bool) mux.MatcherFunc {
	regexPrefix := workspaceIDRegex
	if matchPort {
		regexPrefix = workspacePortRegex + workspaceIDRegex
	}

	// remove (webview-|browser-|extensions-) prefix as soon as Theia removed and new VS Code is used in all workspaces
	r := regexp.MustCompile("^(webview-|browser-|extensions-)?" + regexPrefix + wsHostSuffix)
	foreignContentHostR := regexp.MustCompile("^(.+)(?:foreign)" + wsHostSuffix)
	foreignContentPathR := regexp.MustCompile("^/" + regexPrefix + "(/.*)")
	return func(req *http.Request, m *mux.RouteMatch) bool {
		hostname := headerProvider(req)
		if hostname == "" {
			return false
		}

		var workspaceID, workspacePort, foreignOrigin, foreignPath string
		matches := foreignContentHostR.FindStringSubmatch(hostname)
		if len(matches) == 2 {
			foreignOrigin = matches[1]
			matches = foreignContentPathR.FindStringSubmatch(req.URL.Path)
			if matchPort {
				if len(matches) < 4 {
					return false
				}
				// https://extensions-foreign.ws-eu10.gitpod.io/3000-coral-dragon-ilr0r6eq/index.html
				// workspaceID: coral-dragon-ilr0r6eq
				// workspacePort: 3000
				// foreignOrigin: extensions-
				// foreignPath: /index.html
				workspaceID = matches[2]
				workspacePort = matches[1]
				foreignPath = matches[3]
			} else {
				if len(matches) < 3 {
					return false
				}
				// https://extensions-foreign.ws-eu10.gitpod.io/coral-dragon-ilr0r6eq/index.html
				// workspaceID: coral-dragon-ilr0r6eq
				// workspacePort:
				// foreignOrigin: extensions-
				// foreignPath: /index.html
				workspaceID = matches[1]
				foreignPath = matches[2]
			}
		} else {
			matches = r.FindStringSubmatch(hostname)
			if matchPort {
				if len(matches) < 4 {
					return false
				}
				// https://3000-coral-dragon-ilr0r6eq.ws-eu10.gitpod.io/index.html
				// workspaceID: coral-dragon-ilr0r6eq
				// workspacePort: 3000
				// foreignOrigin:
				// foreignPath:
				workspaceID = matches[3]
				workspacePort = matches[2]
				if len(matches) == 4 {
					// https://extensions-3000-coral-dragon-ilr0r6eq.ws-eu10.gitpod.io/index.html
					// workspaceID: coral-dragon-ilr0r6eq
					// workspacePort: 3000
					// foreignOrigin: extensions-
					// foreignPath:
					foreignOrigin = matches[1]
				}
			} else {
				if len(matches) < 3 {
					return false
				}
				// https://coral-dragon-ilr0r6eq.ws-eu10.gitpod.io/index.html
				// workspaceID: coral-dragon-ilr0r6eq
				// workspacePort:
				// foreignOrigin:
				// foreignPath:
				workspaceID = matches[2]
				if len(matches) == 3 {
					// https://extensions-coral-dragon-ilr0r6eq.ws-eu10.gitpod.io/index.html
					// workspaceID: coral-dragon-ilr0r6eq
					// workspacePort:
					// foreignOrigin: extensions-
					// foreignPath:
					foreignOrigin = matches[1]
				}
			}
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
		if foreignOrigin != "" {
			m.Vars[foreignOriginIdentifier] = foreignOrigin
		}
		if foreignPath != "" {
			m.Vars[foreignPathIdentifier] = foreignPath
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
		return len(matches) >= 1
	}
}

func getWorkspaceCoords(req *http.Request) WorkspaceCoords {
	vars := mux.Vars(req)
	return WorkspaceCoords{
		ID:   vars[workspaceIDIdentifier],
		Port: vars[workspacePortIdentifier],
	}
}
