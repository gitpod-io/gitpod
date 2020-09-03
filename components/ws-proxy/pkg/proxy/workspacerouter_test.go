// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gitpod-io/gitpod/ws-manager/api"
	"github.com/google/go-cmp/cmp"
	"github.com/gorilla/mux"
)

func TestWorkspaceRouter(t *testing.T) {
	const wsHostSuffix = ".ws.gitpod.dev"
	type Expectation struct {
		WorkspaceID        string
		WorkspacePort      string
		Status             int
		URL                string
		AdditionalHitCount int
	}
	tests := []struct {
		Name         string
		URL          string
		Headers      map[string]string
		WSHostSuffix string
		Router       WorkspaceRouter
		Infos        []WorkspaceInfo
		Expected     Expectation
	}{
		{
			Name: "host-based workspace access",
			URL:  "http://c65376da-3406-4cf3-a80b-99ce5f750235.ws.gitpod.dev/",
			Headers: map[string]string{
				forwardedHostnameHeader: "c65376da-3406-4cf3-a80b-99ce5f750235.ws.gitpod.dev",
			},
			Router:       HostBasedRouter(forwardedHostnameHeader, wsHostSuffix),
			WSHostSuffix: wsHostSuffix,
			Expected: Expectation{
				WorkspaceID: "c65376da-3406-4cf3-a80b-99ce5f750235",
				Status:      http.StatusOK,
				URL:         "http://c65376da-3406-4cf3-a80b-99ce5f750235.ws.gitpod.dev/",
			},
		},
		{
			Name: "host-based port access",
			URL:  "http://1234-c65376da-3406-4cf3-a80b-99ce5f750235.ws.gitpod.dev/",
			Headers: map[string]string{
				forwardedHostnameHeader: "1234-c65376da-3406-4cf3-a80b-99ce5f750235.ws.gitpod.dev",
			},
			Router:       HostBasedRouter(forwardedHostnameHeader, wsHostSuffix),
			WSHostSuffix: wsHostSuffix,
			Expected: Expectation{
				WorkspaceID:   "c65376da-3406-4cf3-a80b-99ce5f750235",
				WorkspacePort: "1234",
				Status:        http.StatusOK,
				URL:           "http://1234-c65376da-3406-4cf3-a80b-99ce5f750235.ws.gitpod.dev/",
			},
		},
		{
			Name: "port-based port access",
			URL:  "http://localhost:10343/",
			Router: func(r *mux.Router, wsInfoProvider WorkspaceInfoProvider) (theiaRouter *mux.Router, portRouter *mux.Router) {
				return nil, portBasedRouter(r, wsInfoProvider, true)
			},
			Infos: []WorkspaceInfo{
				{
					WorkspaceID:   "c65376da-3406-4cf3-a80b-99ce5f750235",
					URL:           "http://gitpod-dev.com:10001/",
					IDEPublicPort: "10001",
					Ports: []PortInfo{
						{
							PublicPort: "10343",
							PortSpec: api.PortSpec{
								Port: 8080,
							},
						},
					},
				},
			},
			Expected: Expectation{
				WorkspaceID:   "c65376da-3406-4cf3-a80b-99ce5f750235",
				WorkspacePort: "8080",
				Status:        http.StatusOK,
				URL:           "http://localhost:10343/",
			},
		},
		{
			Name: "path-based workspace access",
			URL:  "http://localhost/c65376da-3406-4cf3-a80b-99ce5f750235",
			Router: func(r *mux.Router, wsInfoProvider WorkspaceInfoProvider) (theiaRouter *mux.Router, portRouter *mux.Router) {
				return pathBasedTheiaRouter(r, wsInfoProvider, ""), nil
			},
			Infos: []WorkspaceInfo{
				{
					WorkspaceID: "c65376da-3406-4cf3-a80b-99ce5f750235",
					URL:         "http://localhost/c65376da-3406-4cf3-a80b-99ce5f750235",
				},
			},
			Expected: Expectation{
				WorkspaceID: "c65376da-3406-4cf3-a80b-99ce5f750235",
				Status:      http.StatusOK,
				URL:         "http://localhost/",
			},
		},
		{
			Name: "path-based workspace path access",
			URL:  "http://localhost/c65376da-3406-4cf3-a80b-99ce5f750235/services",
			Router: func(r *mux.Router, wsInfoProvider WorkspaceInfoProvider) (theiaRouter *mux.Router, portRouter *mux.Router) {
				return pathBasedTheiaRouter(r, wsInfoProvider, ""), nil
			},
			Infos: []WorkspaceInfo{
				{
					WorkspaceID: "c65376da-3406-4cf3-a80b-99ce5f750235",
					URL:         "http://localhost/c65376da-3406-4cf3-a80b-99ce5f750235",
				},
			},
			Expected: Expectation{
				WorkspaceID: "c65376da-3406-4cf3-a80b-99ce5f750235",
				Status:      http.StatusOK,
				URL:         "http://localhost/services",
			},
		},
		{
			Name: "path-based workspace access with prefix",
			URL:  "http://localhost/workspace/c65376da-3406-4cf3-a80b-99ce5f750235/services",
			Router: func(r *mux.Router, wsInfoProvider WorkspaceInfoProvider) (theiaRouter *mux.Router, portRouter *mux.Router) {
				return pathBasedTheiaRouter(r, wsInfoProvider, "/workspace/"), nil
			},
			Infos: []WorkspaceInfo{
				{
					WorkspaceID: "c65376da-3406-4cf3-a80b-99ce5f750235",
					URL:         "http://localhost/c65376da-3406-4cf3-a80b-99ce5f750235",
				},
			},
			Expected: Expectation{
				WorkspaceID: "c65376da-3406-4cf3-a80b-99ce5f750235",
				Status:      http.StatusOK,
				URL:         "http://localhost/services",
			},
		},
		{
			Name:   "path-and-port router: workspace access",
			URL:    "http://localhost/workspace/c65376da-3406-4cf3-a80b-99ce5f750235/services",
			Router: PathAndPortRouter("/workspace/"),
			Infos: []WorkspaceInfo{
				{
					WorkspaceID: "c65376da-3406-4cf3-a80b-99ce5f750235",
					URL:         "http://localhost/c65376da-3406-4cf3-a80b-99ce5f750235",
				},
			},
			Expected: Expectation{
				WorkspaceID: "c65376da-3406-4cf3-a80b-99ce5f750235",
				Status:      http.StatusOK,
				URL:         "http://localhost/services",
			},
		},
		{
			Name:   "path-and-port router: port access",
			URL:    "http://localhost:10343/",
			Router: PathAndPortRouter("/workspace/"),
			Infos: []WorkspaceInfo{
				{
					WorkspaceID: "c65376da-3406-4cf3-a80b-99ce5f750235",
					URL:         "http://localhost/c65376da-3406-4cf3-a80b-99ce5f750235",
					Ports: []PortInfo{
						{
							PublicPort: "10343",
							PortSpec: api.PortSpec{
								Port: 8080,
							},
						},
					},
				},
			},
			Expected: Expectation{
				WorkspaceID:   "c65376da-3406-4cf3-a80b-99ce5f750235",
				WorkspacePort: "8080",
				Status:        http.StatusOK,
				URL:           "http://localhost:10343/",
			},
		},
		{
			Name:   "path-and-host router: workspace access",
			URL:    "http://localhost/workspace/c65376da-3406-4cf3-a80b-99ce5f750235/services",
			Router: PathAndHostRouter("/workspace/", forwardedHostnameHeader, wsHostSuffix),
			Headers: map[string]string{
				forwardedHostnameHeader: "localhost",
			},
			Infos: []WorkspaceInfo{
				{
					WorkspaceID: "c65376da-3406-4cf3-a80b-99ce5f750235",
					URL:         "http://localhost/c65376da-3406-4cf3-a80b-99ce5f750235",
				},
			},
			Expected: Expectation{
				WorkspaceID: "c65376da-3406-4cf3-a80b-99ce5f750235",
				Status:      http.StatusOK,
				URL:         "http://localhost/services",
			},
		},
		{
			Name: "path-and-host router: port access",
			URL:  "http://8080-de5ce5ec-a9ac-49e4-aadc-4827d2dcb189.ws.gitpod.dev/",
			Headers: map[string]string{
				forwardedHostnameHeader: "8080-de5ce5ec-a9ac-49e4-aadc-4827d2dcb189.ws.gitpod.dev",
			},
			Router: PathAndHostRouter("/workspace/", forwardedHostnameHeader, wsHostSuffix),
			Infos: []WorkspaceInfo{
				{
					WorkspaceID: "de5ce5ec-a9ac-49e4-aadc-4827d2dcb189",
					URL:         "http://localhost/de5ce5ec-a9ac-49e4-aadc-4827d2dcb189",
					Ports: []PortInfo{
						{
							PublicPort: "10343",
							PortSpec: api.PortSpec{
								Port: 8080,
							},
						},
					},
				},
			},
			Expected: Expectation{
				WorkspaceID:   "de5ce5ec-a9ac-49e4-aadc-4827d2dcb189",
				WorkspacePort: "8080",
				Status:        http.StatusOK,
				URL:           "http://8080-de5ce5ec-a9ac-49e4-aadc-4827d2dcb189.ws.gitpod.dev/",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			r := mux.NewRouter()
			theiaRouter, portRouter := test.Router(r, &fakeWsInfoProvider{infos: test.Infos})
			var act Expectation
			actRecorder := func(w http.ResponseWriter, req *http.Request) {
				defer w.WriteHeader(200)

				vars := mux.Vars(req)
				if vars == nil {
					return
				}

				act.WorkspaceID = vars[workspaceIDIdentifier]
				act.WorkspacePort = vars[workspacePortIdentifier]
				act.URL = req.URL.String()
				act.AdditionalHitCount++
			}

			if theiaRouter != nil {
				theiaRouter.HandleFunc("/", actRecorder)
				theiaRouter.HandleFunc("/services", actRecorder)
			}
			if portRouter != nil {
				portRouter.HandleFunc("/", actRecorder)
			}

			// build artificial request
			req, err := http.NewRequest("GET", test.URL, nil)
			if err != nil {
				t.Fatal(err)
			}
			for key, value := range test.Headers {
				req.Header.Add(key, value)
			}

			// "send" artificial request with response mock
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)

			// we don't count the first hit to make the expectation structure easier.
			act.AdditionalHitCount--

			act.Status = rr.Code

			if diff := cmp.Diff(test.Expected, act); diff != "" {
				t.Errorf("unexpected response (-want +got):\n%s", diff)
			}
		})
	}
}

func TestMatchWorkspaceHostHeader(t *testing.T) {
	type matchResult struct {
		MatchesWorkspace bool
		MatchesPort      bool
		WorkspaceVars    map[string]string
		PortVars         map[string]string
	}

	wsHostSuffix := ".gitpod.io"
	tests := []struct {
		Name       string
		HostHeader string
		Expected   matchResult
	}{
		{
			Name:       "no match",
			HostHeader: "foobar.com",
		},
		{
			Name:       "no host",
			HostHeader: "",
		},
		{
			Name:       "workspace match",
			HostHeader: "efb3a500-1491-48a1-9ab4-86569a2008de" + wsHostSuffix,
			Expected: matchResult{
				MatchesWorkspace: true,
				WorkspaceVars: map[string]string{
					workspaceIDIdentifier: "efb3a500-1491-48a1-9ab4-86569a2008de",
				},
			},
		},
		{
			Name:       "webview workspace match",
			HostHeader: "webview-efb3a500-1491-48a1-9ab4-86569a2008de" + wsHostSuffix,
			Expected: matchResult{
				MatchesWorkspace: true,
				WorkspaceVars: map[string]string{
					workspaceIDIdentifier: "efb3a500-1491-48a1-9ab4-86569a2008de",
				},
			},
		},
		{
			Name:       "port match",
			HostHeader: "8080-efb3a500-1491-48a1-9ab4-86569a2008de" + wsHostSuffix,
			Expected: matchResult{
				MatchesPort: true,
				PortVars: map[string]string{
					workspaceIDIdentifier:   "efb3a500-1491-48a1-9ab4-86569a2008de",
					workspacePortIdentifier: "8080",
				},
			},
		},
		{
			Name:       "webview port match",
			HostHeader: "webview-8080-efb3a500-1491-48a1-9ab4-86569a2008de" + wsHostSuffix,
			Expected: matchResult{
				MatchesPort: true,
				PortVars: map[string]string{
					workspaceIDIdentifier:   "efb3a500-1491-48a1-9ab4-86569a2008de",
					workspacePortIdentifier: "8080",
				},
			},
		},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			req := &http.Request{
				Host:   test.HostHeader,
				Method: http.MethodGet,
				Header: http.Header{
					forwardedHostnameHeader: []string{test.HostHeader},
				},
			}

			prov := func(req *http.Request) string { return test.HostHeader }

			wsMatch := mux.RouteMatch{Vars: make(map[string]string)}
			matchesWS := matchWorkspaceHostHeader(wsHostSuffix, prov)(req, &wsMatch)
			portMatch := mux.RouteMatch{Vars: make(map[string]string)}
			matchesPort := matchWorkspacePortHostHeader(wsHostSuffix, prov)(req, &portMatch)
			res := matchResult{
				MatchesPort:      matchesPort,
				MatchesWorkspace: matchesWS,
				PortVars:         portMatch.Vars,
				WorkspaceVars:    wsMatch.Vars,
			}
			if len(res.PortVars) == 0 {
				res.PortVars = nil
			}
			if len(res.WorkspaceVars) == 0 {
				res.WorkspaceVars = nil
			}

			if diff := cmp.Diff(test.Expected, res); diff != "" {
				t.Errorf("unexpected response (-want +got):\n%s", diff)
			}
		})
	}
}
