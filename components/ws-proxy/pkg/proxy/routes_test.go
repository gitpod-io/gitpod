// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/google/go-cmp/cmp"
	"github.com/gorilla/mux"
)

// TestRoutes tests the routing behavior - and thus the backend - of ws-proxy. The behavior of the host should be
// completely host-agnostic, so the tests are carried out without any specfic host information
func TestRoutes(t *testing.T) {
	type routerFactory = func(*RouteHandlerConfig, WorkspaceInfoProvider) *mux.Router
	type testRequest struct {
		method  string
		url     string
		headers map[string]string
	}
	type targetResponse struct {
		code    int
		content string
	}
	type proxyTarget struct {
		host     string
		path     string
		response *targetResponse
		handler  http.HandlerFunc
	}
	type expectedResponse struct {
		code    int
		content string
		headers map[string]string
	}
	type handlerTest struct {
		description string
		router      routerFactory
		req         testRequest
		targets     []proxyTarget
		response    expectedResponse
	}

	// config which configures all possible proxy target to reside on "localhost"
	theiaTestPort := uint16(1234)
	theiaTestHost := fmt.Sprintf("localhost:%d", theiaTestPort)
	theiaTestURL := "http://" + theiaTestHost
	portTestHost := "localhost:1236"
	portTestURL := "http://" + portTestHost
	config := &Config{
		TransportConfig: &TransportConfig{
			ConnectTimeout:           util.Duration(10 * time.Second),
			IdleConnTimeout:          util.Duration(60 * time.Second),
			WebsocketIdleConnTimeout: util.Duration(5 * time.Minute),
			MaxIdleConns:             100,
		},
		TheiaServer: &TheiaServer{
			Host:                    theiaTestHost,
			Scheme:                  "http",
			StaticVersionPathPrefix: "/test-version.1234",
		},
		GitpodInstallation: &GitpodInstallation{
			HostName:            "gitpod.io",
			Scheme:              "https",
			WorkspaceHostSuffix: "",
		},
		WorkspacePodConfig: &WorkspacePodConfig{
			ServiceTemplate:     theiaTestURL,
			PortServiceTemplate: portTestURL,
			TheiaPort:           theiaTestPort,
			SupervisorPort:      1235,
		},
	}

	// some common proxy targets
	content := "some content"
	theiaOkResponse := proxyTarget{
		host: theiaTestHost,
		path: "/",
		response: &targetResponse{
			code:    200,
			content: content,
		},
	}
	failOnRequest := func(t *testing.T, host string, path string) proxyTarget {
		return proxyTarget{
			host: host,
			path: path,
			handler: func(w http.ResponseWriter, req *http.Request) {
				t.Error("this should not be called")
			},
		}
	}

	// test table
	tt := []handlerTest{
		{
			description: "Theia: basic GET /",
			router:      theiaRouter,
			req: testRequest{
				method: "GET",
				url:    "/",
			},
			targets: []proxyTarget{
				theiaOkResponse,
			},
			response: expectedResponse{
				code:    200,
				content: content,
			},
		},
		{
			description: "Exposed port: Ensure sessions cookies are filtered",
			router:      portRouter,
			req: testRequest{
				method: "GET",
				url:    "/some/path/on/an/exposed/port",
				headers: map[string]string{
					"Cookie": "_gitpod_io_=s%3Af2da2196-4afe-46e7-97b6-00eadfb4e373.KuHVEHhTuNln8RiegerwgSsAYF0LqwV5wI18tVeUNUw; ",
				},
			},
			targets: []proxyTarget{
				{
					host: portTestHost,
					path: "/",
					handler: func(w http.ResponseWriter, req *http.Request) {
						hostnameSuffix := config.GitpodInstallation.HostName
						hostnameSuffix = strings.ReplaceAll(hostnameSuffix, " ", "_")
						hostnameSuffix = strings.ReplaceAll(hostnameSuffix, "-", "_")
						hostnameSuffix = strings.ReplaceAll(hostnameSuffix, ".", "_")
						hostnameSuffix = strings.ToLower(hostnameSuffix)
						hostnameSuffix = fmt.Sprintf("_%s_", hostnameSuffix)
						for _, cookie := range req.Cookies() {
							if strings.HasSuffix(cookie.Name, "_port_auth_") || strings.HasSuffix(cookie.Name, hostnameSuffix) {
								t.Errorf("requests contained cookie which should have been filtered by name: %s", cookie.Name)
								w.WriteHeader(404)
								return
							}
						}
						w.WriteHeader(200)
					},
				},
			},
			response: expectedResponse{
				code: 200,
			},
		},
		{
			description: "Theia: cors preflight GET /",
			router:      theiaRouter,
			req: testRequest{
				method: "OPTIONS",
				url:    "/",
				headers: map[string]string{
					"Origin":                        config.GitpodInstallation.HostName,
					"Access-Control-Request-Method": "OPTIONS",
				},
			},
			targets: []proxyTarget{
				failOnRequest(t, theiaTestHost, "/"),
			},
			response: expectedResponse{
				code: 200,
				headers: map[string]string{
					"Origin":                       config.GitpodInstallation.HostName,
					"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
				},
			},
		},
		{
			description: "Exposed port: Websocket support does not hinder regular requests",
			router:      portRouter,
			req: testRequest{
				method: "GET",
				url:    "/some/path",
			},
			targets: []proxyTarget{
				{
					host: portTestHost,
					path: "/some/path",
					response: &targetResponse{
						code:    200,
						content: content,
					},
				},
			},
			response: expectedResponse{
				code:    200,
				content: content,
			},
		},
	}

	// execute each proxy test
	for _, tc := range tt {
		t.Run(tc.description, func(t *testing.T) {
			// setup fake proxy target(s)
			var wg sync.WaitGroup
			proxyTargetHandler := http.NewServeMux()
			var netListeners []net.Listener
			for _, target := range tc.targets {
				wg.Add(1)

				tResponse := target.response
				if tResponse != nil {
					proxyTargetHandler.HandleFunc(target.path, func(w http.ResponseWriter, req *http.Request) {
						w.WriteHeader(tResponse.code)
						if tResponse.content != "" {
							_, err := w.Write([]byte(tResponse.content))
							if err != nil {
								t.Fatal("error writing result to response")
							}
						}
					})
				} else if target.handler != nil {
					proxyTargetHandler.HandleFunc(target.path, target.handler)
				}

				srv := &http.Server{Addr: target.host, Handler: proxyTargetHandler}
				// TODO ignore err until we can reliably filter out Accept errors provoked by l.Close below
				//nolint:errcheck
				l, _ := net.Listen("tcp", target.host)
				// if err != nil {
				// 	t.Fatalf("error setting up fake proxy target: %w", err)
				// }
				netListeners = append(netListeners, l)

				go func(t *testing.T, host string) {
					wg.Done()
					//nolint:errcheck
					srv.Serve(l)
				}(t, target.host)
			}
			wg.Wait()

			// setup test handler
			handlerConfig, err := NewRouteHandlerConfig(config)
			if err != nil {
				t.Fatalf("error while creating RouteHandlerConfig: %s", err.Error())
			}
			r := tc.router(handlerConfig, nil)

			// create artificial request
			req, err := http.NewRequest(tc.req.method, tc.req.url, nil)
			if err != nil {
				t.Fatal("error sending test request: %s" + err.Error())
			}
			for k, v := range tc.req.headers {
				req.Header.Add(k, v)
			}

			// "send" artificial request
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)

			// check result
			if rr.Code != tc.response.code {
				t.Errorf("expected code %d, got %d!", tc.response.code, rr.Code)
			}
			if tc.response.content != "" {
				body, err := ioutil.ReadAll(rr.Body)
				if err != nil {
					t.Fatalf("error reading body from fake response: %s", err.Error())
				}

				actualContent := string(body)
				if actualContent != tc.response.content {
					t.Errorf("expected content '%s', got '%s'!", tc.response.content, actualContent)
				}
			}

			for _, l := range netListeners {
				if err := l.Close(); err != nil {
					t.Fatalf("error shutting down fake proxy target: %s", err.Error())
				}
			}
		})
	}
}

func theiaRouter(handlerConfig *RouteHandlerConfig, infoProvider WorkspaceInfoProvider) *mux.Router {
	r := mux.NewRouter()

	handlers := &RouteHandlers{
		theiaRootHandler:            TheiaRootHandler(infoProvider),
		theiaMiniBrowserHandler:     TheiaMiniBrowserHandler,
		theiaFileHandler:            TheiaFileHandler,
		theiaHostedPluginHandler:    TheiaHostedPluginHandler,
		theiaServiceHandler:         TheiaServiceHandler,
		theiaFileUploadHandler:      TheiaFileUploadHandler,
		theiaReadyHandler:           TheiaReadyHandler,
		theiaSupervisorReadyHandler: TheiaSupervisorReadyHandler,
		theiaWebviewHandler:         TheiaWebviewHandler,
	}
	installTheiaRoutes(r, handlerConfig, handlers)
	return r
}
func portRouter(handlerConfig *RouteHandlerConfig, infoProvider WorkspaceInfoProvider) *mux.Router {
	r := mux.NewRouter()
	installWorkspacePortRoutes(r, handlerConfig)
	return r
}

type fakeWsInfoProvider struct {
	infos []WorkspaceInfo
}

// GetWsInfoByID returns the workspace for the given ID
func (p *fakeWsInfoProvider) WorkspaceInfo(workspaceID string) *WorkspaceInfo {
	for _, nfo := range p.infos {
		if nfo.WorkspaceID == workspaceID {
			return &nfo
		}
	}

	return nil
}

// WorkspaceCoords returns the workspace coords for a public port
func (p *fakeWsInfoProvider) WorkspaceCoords(wsProxyPort string) *WorkspaceCoords {
	for _, info := range p.infos {
		if info.IDEPublicPort == wsProxyPort {
			return &WorkspaceCoords{
				ID:   info.WorkspaceID,
				Port: "",
			}
		}

		for _, portInfo := range info.Ports {
			if portInfo.PublicPort == wsProxyPort {
				return &WorkspaceCoords{
					ID:   info.WorkspaceID,
					Port: strconv.Itoa(int(portInfo.Port)),
				}
			}
		}
	}

	return nil
}

func TestRemoveSensitiveCookies(t *testing.T) {
	var (
		domain         = "test-domain.com"
		sessionCookie  = &http.Cookie{Domain: domain, Name: "_test_domain_com_", Value: "fobar"}
		portAuthCookie = &http.Cookie{Domain: domain, Name: "_test_domain_com_ws_77f6b236_3456_4b88_8284_81ca543a9d65_port_auth_", Value: "some-token"}
		ownerCookie    = &http.Cookie{Domain: domain, Name: "_test_domain_com_ws_77f6b236_3456_4b88_8284_81ca543a9d65_owner_", Value: "some-other-token"}
		miscCookie     = &http.Cookie{Domain: domain, Name: "some-other-cookie", Value: "I like cookies"}
	)

	tests := []struct {
		Name     string
		Input    []*http.Cookie
		Expected []*http.Cookie
	}{
		{"no cookies", []*http.Cookie{}, []*http.Cookie{}},
		{"session cookie", []*http.Cookie{sessionCookie, miscCookie}, []*http.Cookie{miscCookie}},
		{"portAuth cookie", []*http.Cookie{portAuthCookie, miscCookie}, []*http.Cookie{miscCookie}},
		{"owner cookie", []*http.Cookie{ownerCookie, miscCookie}, []*http.Cookie{miscCookie}},
		{"misc cookie", []*http.Cookie{miscCookie}, []*http.Cookie{miscCookie}},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			res := removeSensitiveCookies(test.Input, domain)
			if diff := cmp.Diff(test.Expected, res); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}
