// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/gorilla/mux"
)

func TestWorkspaceRouter(t *testing.T) {
	const wsHostRegex = "\\.ws\\.gitpod\\.dev"
	const wsHostSuffix = ".ws.gitpod.dev"
	type Expectation struct {
		WorkspaceID        string
		WorkspacePort      string
		Status             int
		URL                string
		AdditionalHitCount int
		DebugWorkspace     string
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
			URL:  "http://amaranth-smelt-9ba20cc1.ws.gitpod.dev/",
			Headers: map[string]string{
				forwardedHostnameHeader: "amaranth-smelt-9ba20cc1.ws.gitpod.dev",
			},
			Router:       HostBasedRouter(forwardedHostnameHeader, wsHostSuffix, wsHostRegex),
			WSHostSuffix: wsHostSuffix,
			Expected: Expectation{
				WorkspaceID: "amaranth-smelt-9ba20cc1",
				Status:      http.StatusOK,
				URL:         "http://amaranth-smelt-9ba20cc1.ws.gitpod.dev/",
			},
		},
		{
			Name: "host-based debug workspace access",
			URL:  "http://debug-amaranth-smelt-9ba20cc1.ws.gitpod.dev/",
			Headers: map[string]string{
				forwardedHostnameHeader: "debug-amaranth-smelt-9ba20cc1.ws.gitpod.dev",
			},
			Router:       HostBasedRouter(forwardedHostnameHeader, wsHostSuffix, wsHostRegex),
			WSHostSuffix: wsHostSuffix,
			Expected: Expectation{
				DebugWorkspace: "true",
				WorkspaceID:    "amaranth-smelt-9ba20cc1",
				Status:         http.StatusOK,
				URL:            "http://debug-amaranth-smelt-9ba20cc1.ws.gitpod.dev/",
			},
		},
		{
			Name: "host-based port access",
			URL:  "http://1234-amaranth-smelt-9ba20cc1.ws.gitpod.dev/",
			Headers: map[string]string{
				forwardedHostnameHeader: "1234-amaranth-smelt-9ba20cc1.ws.gitpod.dev",
			},
			Router:       HostBasedRouter(forwardedHostnameHeader, wsHostSuffix, wsHostRegex),
			WSHostSuffix: wsHostSuffix,
			Expected: Expectation{
				WorkspaceID:   "amaranth-smelt-9ba20cc1",
				WorkspacePort: "1234",
				Status:        http.StatusOK,
				URL:           "http://1234-amaranth-smelt-9ba20cc1.ws.gitpod.dev/",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			r := mux.NewRouter()
			ideRouter, portRouter, blobserveRouter := test.Router(r, &fakeWsInfoProvider{infos: test.Infos})
			var act Expectation
			actRecorder := func(w http.ResponseWriter, req *http.Request) {
				defer w.WriteHeader(http.StatusOK)

				vars := mux.Vars(req)
				if vars == nil {
					return
				}

				act.WorkspaceID = vars[workspaceIDIdentifier]
				act.WorkspacePort = vars[workspacePortIdentifier]
				act.DebugWorkspace = vars[debugWorkspaceIdentifier]
				act.URL = req.URL.String()
				act.AdditionalHitCount++
			}

			if ideRouter != nil {
				ideRouter.HandleFunc("/", actRecorder)
				ideRouter.HandleFunc("/services", actRecorder)
			}
			if portRouter != nil {
				portRouter.HandleFunc("/", actRecorder)
			}
			if blobserveRouter != nil {
				blobserveRouter.HandleFunc("/", actRecorder)
				blobserveRouter.HandleFunc("/image:version:/foo/main.js", actRecorder)
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
		Path       string
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
			Name:       "no match 2",
			HostHeader: "0d9rkrj560blqb5s07q431ru9mhg19k1k4bqgd1dbprtgmt7vuhk" + wsHostSuffix,
			Path:       "eu.gcr.io/gitpod-core-dev/build/ide/code:nightly@sha256:41aeea688aa0943bd746cb70c4ed378910f7c7ecf56f5f53ccb2b76c6b68e1a7/__files__/index.html",
		},
		{
			Name:       "no match 3",
			HostHeader: "v--0d9rkrj560blqb5s07q431ru9mhg19k1k4bqgd1dbprtgmt7vuhk" + wsHostSuffix,
			Path:       "eu.gcr.io/gitpod-core-dev/build/ide/code:nightly@sha256:41aeea688aa0943bd746cb70c4ed378910f7c7ecf56f5f53ccb2b76c6b68e1a7/__files__/index.html",
		},
		{
			Name:       "workspace match",
			HostHeader: "amaranth-smelt-9ba20cc1" + wsHostSuffix,
			Expected: matchResult{
				MatchesWorkspace: true,
				WorkspaceVars: map[string]string{
					workspaceIDIdentifier: "amaranth-smelt-9ba20cc1",
				},
			},
		},
		{
			Name:       "port match",
			HostHeader: "8080-amaranth-smelt-9ba20cc1" + wsHostSuffix,
			Expected: matchResult{
				MatchesPort: true,
				PortVars: map[string]string{
					workspaceIDIdentifier:   "amaranth-smelt-9ba20cc1",
					workspacePortIdentifier: "8080",
				},
			},
		},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			req := &http.Request{
				Host: test.HostHeader,
				URL: &url.URL{
					Path: test.Path,
				},
				Method: http.MethodGet,
				Header: http.Header{
					forwardedHostnameHeader: []string{test.HostHeader},
				},
			}

			prov := func(req *http.Request) string { return test.HostHeader }

			wsMatch := mux.RouteMatch{Vars: make(map[string]string)}
			matchesWS := matchWorkspaceHostHeader(wsHostSuffix, prov, false)(req, &wsMatch)
			portMatch := mux.RouteMatch{Vars: make(map[string]string)}
			matchesPort := matchWorkspaceHostHeader(wsHostSuffix, prov, true)(req, &portMatch)
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

func TestAcmeHandler(t *testing.T) {
	type Expectation struct {
		ContentType string
		Code        int
	}
	tests := []struct {
		Name        string
		Method      string
		URL         string
		Body        []byte
		Expectation Expectation
	}{
		{
			Name:   "Valid acme request",
			Method: http.MethodGet,
			URL:    "http://domain.example.com/.well-known/acme-challenge/token1",
			Expectation: Expectation{
				Code:        403,
				ContentType: "text/plain; charset=utf-8",
			},
		},
		{
			Name:   "Not an acme request",
			Method: http.MethodGet,
			URL:    "http://domain.example.com/",
			Expectation: Expectation{
				Code:        404,
				ContentType: "text/plain; charset=utf-8",
			},
		},
		{
			Name:   "Valid acme request",
			Method: http.MethodGet,
			URL:    "http://1.1.1.1/.well-known/acme-challenge/token1",
			Expectation: Expectation{
				Code:        403,
				ContentType: "text/plain; charset=utf-8",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			req, err := http.NewRequest(test.Method, test.URL, nil)
			if err != nil {
				t.Errorf("unexpected error:%v", err)
			}

			w := httptest.NewRecorder()

			r := mux.NewRouter()
			setupAcmeRouter(r)

			r.ServeHTTP(w, req)

			act := Expectation{
				ContentType: w.Header().Get("Content-Type"),
				Code:        w.Code,
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}
