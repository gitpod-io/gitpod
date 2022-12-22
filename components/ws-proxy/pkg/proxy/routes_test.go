// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gitpod-io/golang-crypto/ssh"
	"github.com/google/go-cmp/cmp"
	"github.com/sirupsen/logrus"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/util"
	"github.com/gitpod-io/gitpod/ws-manager/api"
)

const (
	hostBasedHeader = "x-host-header"
	wsHostSuffix    = ".test-domain.com"
	wsHostNameRegex = "\\.test-domain\\.com"
)

var (
	debugWorkspaceURL = "https://debug-amaranth-smelt-9ba20cc1.test-domain.com/"
	workspaces        = []WorkspaceInfo{
		{
			IDEImage:        "gitpod-io/ide:latest",
			SupervisorImage: "gitpod-io/supervisor:latest",
			Auth: &api.WorkspaceAuthentication{
				Admission:  api.AdmissionLevel_ADMIT_OWNER_ONLY,
				OwnerToken: "owner-token",
			},
			IDEPublicPort: "23000",
			InstanceID:    "1943c611-a014-4f4d-bf5d-14ccf0123c60",
			Ports: []*api.PortSpec{
				{Port: 28080, Url: "https://28080-amaranth-smelt-9ba20cc1.test-domain.com/", Visibility: api.PortVisibility_PORT_VISIBILITY_PUBLIC},
			},
			URL:         "https://amaranth-smelt-9ba20cc1.test-domain.com/",
			WorkspaceID: "amaranth-smelt-9ba20cc1",
		},
	}

	ideServerHost       = "localhost:20000"
	workspacePort       = uint16(20001)
	supervisorPort      = uint16(20002)
	workspaceDebugPort  = uint16(20004)
	supervisorDebugPort = uint16(20005)
	workspaceHost       = fmt.Sprintf("localhost:%d", workspacePort)
	portServeHost       = fmt.Sprintf("localhost:%d", workspaces[0].Ports[0].Port)
	blobServeHost       = "localhost:20003"

	config = Config{
		TransportConfig: &TransportConfig{
			ConnectTimeout:      util.Duration(10 * time.Second),
			IdleConnTimeout:     util.Duration(60 * time.Second),
			MaxIdleConns:        0,
			MaxIdleConnsPerHost: 100,
		},
		GitpodInstallation: &GitpodInstallation{
			HostName:            "test-domain.com",
			Scheme:              "https",
			WorkspaceHostSuffix: ".ws.test-domain.com",
		},
		BlobServer: &BlobServerConfig{
			Host:   blobServeHost,
			Scheme: "http",
		},
		WorkspacePodConfig: &WorkspacePodConfig{
			TheiaPort:           workspacePort,
			SupervisorPort:      supervisorPort,
			IDEDebugPort:        workspaceDebugPort,
			SupervisorDebugPort: supervisorDebugPort,
		},
		BuiltinPages: BuiltinPagesConfig{
			Location: "../../public",
		},
	}
)

type Target struct {
	Status  int
	Handler func(w http.ResponseWriter, r *http.Request, requestCount uint8)
}

type testTarget struct {
	Target       *Target
	RequestCount uint8
	listener     net.Listener
	server       *http.Server
}

func (tt *testTarget) Close() {
	_ = tt.listener.Close()
	_ = tt.server.Shutdown(context.Background())
}

// startTestTarget starts a new HTTP server that serves as some test target during the unit tests.
func startTestTarget(t *testing.T, host, name string, checkedHost bool) *testTarget {
	t.Helper()

	l, err := net.Listen("tcp", host)
	if err != nil {
		t.Fatalf("cannot start fake IDE host: %q", err)
		return nil
	}

	tt := &testTarget{
		Target:   &Target{Status: http.StatusOK},
		listener: l,
	}
	srv := &http.Server{Addr: host, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			tt.RequestCount++
		}()

		if tt.Target.Handler != nil {
			tt.Target.Handler(w, r, tt.RequestCount)
			return
		}

		if tt.Target.Status == http.StatusOK {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			format := "%s hit: %s\n"
			args := []interface{}{name, r.URL.String()}
			if checkedHost {
				format += "host: %s\n"
				args = append(args, r.Host)
			}
			inlineVars := r.Header.Get("X-BlobServe-InlineVars")
			if inlineVars != "" {
				format += "inlineVars: %s\n"
				args = append(args, inlineVars)
			}
			fmt.Fprintf(w, format, args...)
			return
		}

		if tt.Target.Status != 0 {
			w.WriteHeader(tt.Target.Status)
			return
		}
		w.WriteHeader(http.StatusOK)
	})}
	go func() { _ = srv.Serve(l) }()
	tt.server = srv

	return tt
}

type requestModifier func(r *http.Request)

func addHeader(name string, val string) requestModifier {
	return func(r *http.Request) {
		r.Header.Add(name, val)
	}
}

func addHostHeader(r *http.Request) {
	r.Header.Add(hostBasedHeader, r.Host)
}

func addOwnerToken(instanceID, token string) requestModifier {
	return func(r *http.Request) {
		setOwnerTokenCookie(r, instanceID, token)
	}
}

func addCookie(c http.Cookie) requestModifier {
	return func(r *http.Request) {
		r.AddCookie(&c)
	}
}

func modifyRequest(r *http.Request, mod ...requestModifier) *http.Request {
	for _, m := range mod {
		m(r)
	}
	return r
}

func TestRoutes(t *testing.T) {
	type RouterFactory func(cfg *Config) WorkspaceRouter
	type Expectation struct {
		Status int
		Header http.Header
		Body   string
	}
	type Targets struct {
		IDE             *Target
		Blobserve       *Target
		Workspace       *Target
		DebugWorkspace  *Target
		Supervisor      *Target
		DebugSupervisor *Target
		Port            *Target
	}
	tests := []struct {
		Desc        string
		Config      *Config
		Request     *http.Request
		Router      RouterFactory
		Targets     *Targets
		IgnoreBody  bool
		Expectation Expectation
	}{
		{
			Desc: "favicon",
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].URL+"favicon.ico", nil),
				addHostHeader,
			),
			Expectation: Expectation{
				Status: http.StatusSeeOther,
				Header: http.Header{
					"Content-Type": {"text/html; charset=utf-8"},
					"Location": {
						"https://ide.test-domain.com/blobserve/gitpod-io/supervisor:latest/__files__/favicon.ico",
					},
					"Vary": {"Accept-Encoding"},
				},
				Body: "<a href=\"https://ide.test-domain.com/blobserve/gitpod-io/supervisor:latest/__files__/favicon.ico\">See Other</a>.\n\n",
			},
		},
		{
			Desc:   "blobserve IDE unauthorized GET /",
			Config: &config,
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].URL, nil),
				addHostHeader,
			),
			Expectation: Expectation{
				Status: http.StatusSeeOther,
				Header: http.Header{
					"Content-Type": {"text/html; charset=utf-8"},
					"Location":     {"https://ide.test-domain.com/blobserve/gitpod-io/ide:latest/__files__/"},
					"Vary":         {"Accept-Encoding"},
				},
				Body: "<a href=\"https://ide.test-domain.com/blobserve/gitpod-io/ide:latest/__files__/\">See Other</a>.\n\n",
			},
		},
		{
			Desc:   "blobserve IDE unauthorized navigate /",
			Config: &config,
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].URL, nil),
				addHostHeader,
				addHeader("Sec-Fetch-Mode", "navigate"),
			),
			Expectation: Expectation{
				Status: http.StatusOK,
				Header: http.Header{
					"Content-Length": {"242"},
					"Content-Type":   {"text/plain; charset=utf-8"},
					"Vary":           {"Accept-Encoding"},
				},
				Body: "blobserve hit: /gitpod-io/ide:latest/\nhost: localhost:20003\ninlineVars: {\"ide\":\"https://ide.test-domain.com/blobserve/gitpod-io/ide:latest/__files__\",\"supervisor\":\"https://ide.test-domain.com/blobserve/gitpod-io/supervisor:latest/__files__\"}\n",
			},
		},
		{
			Desc:   "blobserve IDE unauthorized same-origin /",
			Config: &config,
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].URL, nil),
				addHostHeader,
				addHeader("Sec-Fetch-Mode", "same-origin"),
			),
			Expectation: Expectation{
				Status: http.StatusOK,
				Header: http.Header{
					"Content-Length": {"242"},
					"Content-Type":   {"text/plain; charset=utf-8"},
					"Vary":           {"Accept-Encoding"},
				},
				Body: "blobserve hit: /gitpod-io/ide:latest/\nhost: localhost:20003\ninlineVars: {\"ide\":\"https://ide.test-domain.com/blobserve/gitpod-io/ide:latest/__files__\",\"supervisor\":\"https://ide.test-domain.com/blobserve/gitpod-io/supervisor:latest/__files__\"}\n",
			},
		},
		{
			Desc:   "blobserve IDE authorized GET /?foobar",
			Config: &config,
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].URL+"?foobar", nil),
				addHostHeader,
				addOwnerToken(workspaces[0].InstanceID, workspaces[0].Auth.OwnerToken),
			),
			Targets: &Targets{Workspace: &Target{Status: http.StatusOK}},
			Expectation: Expectation{
				Status: http.StatusOK,
				Header: http.Header{
					"Content-Length": {"24"},
					"Content-Type":   {"text/plain; charset=utf-8"},
					"Vary":           {"Accept-Encoding"},
				},
				Body: "workspace hit: /?foobar\n",
			},
		},
		{
			Desc:   "blobserve IDE authorized GET /not-from-blobserve",
			Config: &config,
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].URL+"not-from-blobserve", nil),
				addHostHeader,
				addOwnerToken(workspaces[0].InstanceID, workspaces[0].Auth.OwnerToken),
			),
			Targets: &Targets{Workspace: &Target{Status: http.StatusOK}, Blobserve: &Target{Status: http.StatusNotFound}},
			Expectation: Expectation{
				Status: http.StatusOK,
				Header: http.Header{
					"Content-Length": {"35"},
					"Content-Type":   {"text/plain; charset=utf-8"},
					"Vary":           {"Accept-Encoding"},
				},
				Body: "workspace hit: /not-from-blobserve\n",
			},
		},
		{
			Desc:   "blobserve IDE authorized GET /not-from-failed-blobserve",
			Config: &config,
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].URL+"not-from-failed-blobserve", nil),
				addHostHeader,
				addOwnerToken(workspaces[0].InstanceID, workspaces[0].Auth.OwnerToken),
			),
			Targets: &Targets{Workspace: &Target{Status: http.StatusOK}, Blobserve: &Target{Status: http.StatusInternalServerError}},
			Expectation: Expectation{
				Status: http.StatusOK,
				Header: http.Header{
					"Content-Length": {"42"},
					"Content-Type":   {"text/plain; charset=utf-8"},
					"Vary":           {"Accept-Encoding"},
				},
				Body: "workspace hit: /not-from-failed-blobserve\n",
			},
		},
		{
			Desc:   "blobserve foreign resource",
			Config: &config,
			Request: modifyRequest(httptest.NewRequest("GET", "https://v--sr1o1nu24nqdf809l0u27jk5t7"+wsHostSuffix+"/image/__files__/test.html", nil),
				addHostHeader,
				addHeader("Sec-Fetch-Mode", "navigate"),
			),
			Expectation: Expectation{
				Status: http.StatusOK,
				Header: http.Header{
					"Cache-Control":  {"public, max-age=31536000"},
					"Content-Length": {"54"},
					"Content-Type":   {"text/plain; charset=utf-8"},
				},
				Body: "blobserve hit: /image/test.html\nhost: localhost:20003\n",
			},
		},
		{
			Desc:   "port foreign resource",
			Config: &config,
			Request: modifyRequest(httptest.NewRequest("GET", "https://v--sr1o1nu24nqdf809l0u27jk5t7"+wsHostSuffix+"/28080-amaranth-smelt-9ba20cc1/test.html", nil),
				addHostHeader,
				addOwnerToken(workspaces[0].InstanceID, workspaces[0].Auth.OwnerToken),
			),
			Targets: &Targets{
				Port: &Target{
					Handler: func(w http.ResponseWriter, r *http.Request, requestCount uint8) {
						fmt.Fprintf(w, "host: %s\n", r.Host)
						fmt.Fprintf(w, "path: %s\n", r.URL.Path)
					},
				},
			},
			Expectation: Expectation{
				Status: http.StatusOK,
				Header: http.Header{
					"Content-Length": {"69"},
					"Content-Type":   {"text/plain; charset=utf-8"},
				},
				Body: "host: v--sr1o1nu24nqdf809l0u27jk5t7.test-domain.com\npath: /test.html\n",
			},
		},
		{
			Desc:   "debug foreign resource",
			Config: &config,
			Request: modifyRequest(httptest.NewRequest("GET", "https://v--sr1o1nu24nqdf809l0u27jk5t7"+wsHostSuffix+"/debug-amaranth-smelt-9ba20cc1/test.html", nil),
				addHostHeader,
				addOwnerToken(workspaces[0].InstanceID, workspaces[0].Auth.OwnerToken),
			),
			Targets: &Targets{
				DebugWorkspace: &Target{
					Handler: func(w http.ResponseWriter, r *http.Request, requestCount uint8) {
						fmt.Fprintf(w, "host: %s\n", r.Host)
						fmt.Fprintf(w, "path: %s\n", r.URL.Path)
					},
				},
			},
			Expectation: Expectation{
				Status: http.StatusOK,
				Header: http.Header{
					"Content-Length": {"69"},
					"Content-Type":   {"text/plain; charset=utf-8"},
				},
				Body: "host: v--sr1o1nu24nqdf809l0u27jk5t7.test-domain.com\npath: /test.html\n",
			},
		},
		{
			Desc:   "CORS preflight",
			Config: &config,
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].URL+"somewhere/in/the/ide", nil),
				addHostHeader,
				addOwnerToken(workspaces[0].InstanceID, workspaces[0].Auth.OwnerToken),
				addHeader("Origin", config.GitpodInstallation.HostName),
				addHeader("Access-Control-Request-Method", "OPTIONS"),
			),
			Targets: &Targets{Workspace: &Target{Status: http.StatusOK}, Blobserve: &Target{Status: http.StatusNotFound}},
			Expectation: Expectation{
				Status: http.StatusOK,
				Header: http.Header{
					"Access-Control-Allow-Credentials": {"true"},
					"Access-Control-Allow-Origin":      {"test-domain.com"},
					"Access-Control-Expose-Headers":    {"Authorization"},
					"Content-Length":                   {"37"},
					"Content-Type":                     {"text/plain; charset=utf-8"},
					"Vary":                             {"Accept-Encoding"},
				},
				Body: "workspace hit: /somewhere/in/the/ide\n",
			},
		},
		{
			Desc: "unauthenticated supervisor API (supervisor status)",
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].URL+"_supervisor/v1/status/supervisor", nil),
				addHostHeader,
			),
			Expectation: Expectation{
				Status: http.StatusOK,
				Header: http.Header{
					"Content-Length": {"50"},
					"Content-Type":   {"text/plain; charset=utf-8"},
				},
				Body: "supervisor hit: /_supervisor/v1/status/supervisor\n",
			},
		},
		{
			Desc: "unauthenticated supervisor API (IDE status)",
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].URL+"_supervisor/v1/status/ide", nil),
				addHostHeader,
			),
			Expectation: Expectation{
				Status: http.StatusOK,
				Header: http.Header{
					"Content-Length": {"43"},
					"Content-Type":   {"text/plain; charset=utf-8"},
				},
				Body: "supervisor hit: /_supervisor/v1/status/ide\n",
			},
		},
		{
			Desc: "unauthenticated supervisor API (content status)",
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].URL+"_supervisor/v1/status/content", nil),
				addHostHeader,
			),
			Expectation: Expectation{
				Status: http.StatusUnauthorized,
			},
		},
		{
			Desc: "authenticated supervisor API (content status)",
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].URL+"_supervisor/v1/status/content", nil),
				addHostHeader,
				addOwnerToken(workspaces[0].InstanceID, workspaces[0].Auth.OwnerToken),
			),
			Expectation: Expectation{
				Status: http.StatusOK,
				Header: http.Header{
					"Content-Length": {"47"},
					"Content-Type":   {"text/plain; charset=utf-8"},
				},
				Body: "supervisor hit: /_supervisor/v1/status/content\n",
			},
		},
		{
			Desc: "non-existent authorized GET /",
			Request: modifyRequest(httptest.NewRequest("GET", strings.ReplaceAll(workspaces[0].URL, "amaranth", "blabla"), nil),
				addHostHeader,
				addOwnerToken(workspaces[0].InstanceID, workspaces[0].Auth.OwnerToken),
			),
			Expectation: Expectation{
				Status: http.StatusFound,
				Header: http.Header{
					"Content-Type": {"text/html; charset=utf-8"},
					"Location":     {"https://test-domain.com/start/?not_found=true#blabla-smelt-9ba20cc1"},
					"Vary":         {"Accept-Encoding"},
				},
				Body: ("<a href=\"https://test-domain.com/start/?not_found=true#blabla-smelt-9ba20cc1\">Found</a>.\n\n"),
			},
		},
		{
			Desc: "non-existent unauthorized GET /",
			Request: modifyRequest(httptest.NewRequest("GET", strings.ReplaceAll(workspaces[0].URL, "amaranth", "blabla"), nil),
				addHostHeader,
			),
			Expectation: Expectation{
				Status: http.StatusFound,
				Header: http.Header{
					"Content-Type": {"text/html; charset=utf-8"},
					"Location":     {"https://test-domain.com/start/?not_found=true#blabla-smelt-9ba20cc1"},
					"Vary":         {"Accept-Encoding"},
				},
				Body: ("<a href=\"https://test-domain.com/start/?not_found=true#blabla-smelt-9ba20cc1\">Found</a>.\n\n"),
			},
		},
		{
			Desc:   "blobserve supervisor frontend /worker-proxy.js",
			Config: &config,
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].URL+"_supervisor/frontend/worker-proxy.js", nil),
				addHostHeader,
			),
			Expectation: Expectation{
				Status: http.StatusOK,
				Header: http.Header{
					"Content-Length": {"82"},
					"Content-Type":   {"text/plain; charset=utf-8"},
					"Vary":           {"Accept-Encoding"},
				},
				Body: "blobserve hit: /gitpod-io/supervisor:latest/worker-proxy.js\nhost: localhost:20003\n",
			},
		},
		{
			Desc:   "blobserve supervisor frontend /main.js",
			Config: &config,
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].URL+"_supervisor/frontend/main.js", nil),
				addHostHeader,
			),
			Expectation: Expectation{
				Status: http.StatusSeeOther,
				Header: http.Header{
					"Content-Type": {"text/html; charset=utf-8"},
					"Location":     {"https://ide.test-domain.com/blobserve/gitpod-io/supervisor:latest/__files__/main.js"},
					"Vary":         {"Accept-Encoding"},
				},
				Body: "<a href=\"https://ide.test-domain.com/blobserve/gitpod-io/supervisor:latest/__files__/main.js\">See Other</a>.\n\n",
			},
		},
		{
			Desc:   "blobserve supervisor frontend /main.js retry on timeout",
			Config: &config,
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].URL+"_supervisor/frontend/main.js", nil),
				addHostHeader,
			),
			Targets: &Targets{Blobserve: &Target{
				Handler: func(w http.ResponseWriter, r *http.Request, requestCount uint8) {
					if requestCount == 0 {
						w.WriteHeader(http.StatusServiceUnavailable)
						_, _ = io.WriteString(w, "timeout")
						return
					}
					w.WriteHeader(http.StatusOK)
				},
			}},
			Expectation: Expectation{
				Status: http.StatusSeeOther,
				Header: http.Header{
					"Content-Type": {"text/html; charset=utf-8"},
					"Location":     {"https://ide.test-domain.com/blobserve/gitpod-io/supervisor:latest/__files__/main.js"},
					"Vary":         {"Accept-Encoding"},
				},
				Body: "<a href=\"https://ide.test-domain.com/blobserve/gitpod-io/supervisor:latest/__files__/main.js\">See Other</a>.\n\n",
			},
		},
		{
			Desc: "port GET 404",
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].Ports[0].Url+"this-does-not-exist", nil),
				addHostHeader,
				addOwnerToken(workspaces[0].InstanceID, workspaces[0].Auth.OwnerToken),
			),
			Targets: &Targets{Port: &Target{
				Handler: func(w http.ResponseWriter, r *http.Request, requestCount uint8) {
					w.WriteHeader(http.StatusNotFound)
					fmt.Fprintf(w, "host: %s\n", r.Host)
				},
			}},
			Expectation: Expectation{
				Header: http.Header{"Content-Length": {"52"}, "Content-Type": {"text/plain; charset=utf-8"}},
				Status: http.StatusNotFound,
				Body:   "host: 28080-amaranth-smelt-9ba20cc1.test-domain.com\n",
			},
		},
		{
			Desc: "port GET unexposed",
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].Ports[0].Url+"this-does-not-exist", nil),
				addHostHeader,
				addOwnerToken(workspaces[0].InstanceID, workspaces[0].Auth.OwnerToken),
			),
			Targets:    &Targets{},
			IgnoreBody: true,
			Expectation: Expectation{
				Status: http.StatusNotFound,
				Body:   "",
			},
		},
		{
			Desc: "port cookies",
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].Ports[0].Url+"this-does-not-exist", nil),
				addHostHeader,
				addOwnerToken(workspaces[0].InstanceID, workspaces[0].Auth.OwnerToken),
				addCookie(http.Cookie{Name: "foobar", Value: "baz"}),
				addCookie(http.Cookie{Name: "another", Value: "cookie"}),
			),
			Targets: &Targets{
				Port: &Target{
					Handler: func(w http.ResponseWriter, r *http.Request, requestCount uint8) {
						fmt.Fprintf(w, "host: %s\n", r.Host)
						fmt.Fprintf(w, "%+q\n", r.Header["Cookie"])
					},
				},
			},
			Expectation: Expectation{
				Status: http.StatusOK,
				Header: http.Header{"Content-Length": {"82"}, "Content-Type": {"text/plain; charset=utf-8"}},
				Body:   "host: 28080-amaranth-smelt-9ba20cc1.test-domain.com\n[\"foobar=baz;another=cookie\"]\n",
			},
		},
		{
			Desc: "port GET 200 w/o X-Frame-Options header",
			Request: modifyRequest(httptest.NewRequest("GET", workspaces[0].Ports[0].Url+"returns-200-with-frame-options-header", nil),
				addHostHeader,
				addOwnerToken(workspaces[0].InstanceID, workspaces[0].Auth.OwnerToken),
			),
			Targets: &Targets{
				Port: &Target{
					Handler: func(w http.ResponseWriter, r *http.Request, requestCount uint8) {
						w.Header().Add("X-Frame-Options", "sameorigin")
						fmt.Fprintf(w, "host: %s\n", r.Host)
						w.WriteHeader(http.StatusOK)
					},
				},
			},
			Expectation: Expectation{
				Header: http.Header{
					"Content-Length": {"52"},
					"Content-Type":   {"text/plain; charset=utf-8"},
				},
				Status: http.StatusOK,
				Body:   "host: 28080-amaranth-smelt-9ba20cc1.test-domain.com\n",
			},
		},
		{
			Desc:   "debug IDE authorized GE",
			Config: &config,
			Request: modifyRequest(httptest.NewRequest("GET", debugWorkspaceURL, nil),
				addHostHeader,
				addOwnerToken(workspaces[0].InstanceID, workspaces[0].Auth.OwnerToken),
			),
			Targets: &Targets{DebugWorkspace: &Target{Status: http.StatusOK}},
			Expectation: Expectation{
				Status: http.StatusOK,
				Header: http.Header{
					"Content-Length": {"23"},
					"Content-Type":   {"text/plain; charset=utf-8"},
					"Vary":           {"Accept-Encoding"},
				},
				Body: "debug workspace hit: /\n",
			},
		},
		{
			Desc:   "debug supervisor frontend /main.js",
			Config: &config,
			Request: modifyRequest(httptest.NewRequest("GET", debugWorkspaceURL+"_supervisor/frontend/main.js", nil),
				addHostHeader,
			),
			Targets: &Targets{DebugSupervisor: &Target{Status: http.StatusOK}},
			Expectation: Expectation{
				Status: http.StatusOK,
				Header: http.Header{
					"Content-Length": {"52"},
					"Content-Type":   {"text/plain; charset=utf-8"},
					"Vary":           {"Accept-Encoding"},
				},
				Body: "supervisor debug hit: /_supervisor/frontend/main.js\n",
			},
		},
	}

	log.Init("ws-proxy-test", "", false, true)
	log.Log.Logger.SetLevel(logrus.ErrorLevel)

	defaultTargets := &Targets{
		IDE:        &Target{Status: http.StatusOK},
		Blobserve:  &Target{Status: http.StatusOK},
		Port:       &Target{Status: http.StatusOK},
		Supervisor: &Target{Status: http.StatusOK},
		Workspace:  &Target{Status: http.StatusOK},
	}
	targets := make(map[string]*testTarget)
	controlTarget := func(target *Target, name, host string, checkedHost bool) {
		_, runs := targets[name]
		if runs && target == nil {
			targets[name].Close()
			delete(targets, name)
			return
		}

		if !runs && target != nil {
			targets[name] = startTestTarget(t, host, name, checkedHost)
			runs = true
		}

		if runs {
			targets[name].Target = target
			targets[name].RequestCount = 0
		}
	}
	defer func() {
		for _, c := range targets {
			c.Close()
		}
	}()

	for _, test := range tests {
		if test.Targets == nil {
			test.Targets = defaultTargets
		}

		t.Run(test.Desc, func(t *testing.T) {
			controlTarget(test.Targets.IDE, "IDE", ideServerHost, false)
			controlTarget(test.Targets.Blobserve, "blobserve", blobServeHost, true)
			controlTarget(test.Targets.Port, "port", portServeHost, true)
			controlTarget(test.Targets.Workspace, "workspace", workspaceHost, false)
			controlTarget(test.Targets.DebugWorkspace, "debug workspace", fmt.Sprintf("localhost:%d", workspaceDebugPort), false)
			controlTarget(test.Targets.Supervisor, "supervisor", fmt.Sprintf("localhost:%d", supervisorPort), false)
			controlTarget(test.Targets.DebugSupervisor, "supervisor debug", fmt.Sprintf("localhost:%d", supervisorDebugPort), false)

			cfg := config
			if test.Config != nil {
				cfg = *test.Config
				err := cfg.Validate()
				if err != nil {
					t.Fatalf("invalid configuration: %q", err)
				}
			}
			router := HostBasedRouter(hostBasedHeader, wsHostSuffix, wsHostNameRegex)
			if test.Router != nil {
				router = test.Router(&cfg)
			}

			ingress := HostBasedIngressConfig{
				HTTPAddress:  "8080",
				HTTPSAddress: "9090",
				Header:       "",
			}

			proxy := NewWorkspaceProxy(ingress, cfg, router, &fakeWsInfoProvider{infos: workspaces}, nil)
			handler, err := proxy.Handler()
			if err != nil {
				t.Fatalf("cannot create proxy handler: %q", err)
			}

			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, test.Request)
			resp := rec.Result()

			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			act := Expectation{
				Status: resp.StatusCode,
				Body:   string(body),
				Header: resp.Header,
			}

			delete(act.Header, "Date")

			if len(act.Header) == 0 {
				act.Header = nil
			}
			if test.IgnoreBody == true {
				test.Expectation.Body = act.Body
			}
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("Expectation mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

type fakeWsInfoProvider struct {
	infos []WorkspaceInfo
}

// GetWsInfoByID returns the workspace for the given ID.
func (p *fakeWsInfoProvider) WorkspaceInfo(workspaceID string) *WorkspaceInfo {
	for _, nfo := range p.infos {
		if nfo.WorkspaceID == workspaceID {
			return &nfo
		}
	}

	return nil
}

// WorkspaceCoords returns the workspace coords for a public port.
func (p *fakeWsInfoProvider) WorkspaceCoords(wsProxyPort string) *WorkspaceCoords {
	for _, info := range p.infos {
		if info.IDEPublicPort == wsProxyPort {
			return &WorkspaceCoords{
				ID:   info.WorkspaceID,
				Port: "",
			}
		}

		for _, portInfo := range info.Ports {
			if fmt.Sprint(portInfo.Port) == wsProxyPort {
				return &WorkspaceCoords{
					ID:   info.WorkspaceID,
					Port: strconv.Itoa(int(portInfo.Port)),
				}
			}
		}
	}

	return nil
}

func TestSSHGatewayRouter(t *testing.T) {
	generatePrivateKey := func() ssh.Signer {
		prik, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			return nil
		}
		b := pem.EncodeToMemory(&pem.Block{
			Bytes: x509.MarshalPKCS1PrivateKey(prik),
			Type:  "RSA PRIVATE KEY",
		})
		signal, err := ssh.ParsePrivateKey(b)
		if err != nil {
			return nil
		}
		return signal
	}

	tests := []struct {
		Name     string
		Input    []ssh.Signer
		Expected int
	}{
		{"one hostkey", []ssh.Signer{generatePrivateKey()}, 1},
		{"multi hostkey", []ssh.Signer{generatePrivateKey(), generatePrivateKey()}, 2},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			router := HostBasedRouter(hostBasedHeader, wsHostSuffix, wsHostNameRegex)
			ingress := HostBasedIngressConfig{
				HTTPAddress:  "8080",
				HTTPSAddress: "9090",
				Header:       "",
			}

			proxy := NewWorkspaceProxy(ingress, config, router, &fakeWsInfoProvider{infos: workspaces}, test.Input)
			handler, err := proxy.Handler()
			if err != nil {
				t.Fatalf("cannot create proxy handler: %q", err)
			}

			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, modifyRequest(httptest.NewRequest("GET", workspaces[0].URL+"_ssh/host_keys", nil),
				addHostHeader,
			))
			resp := rec.Result()
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			if resp.StatusCode != 200 {
				t.Fatalf("status code should be 200, but got %d", resp.StatusCode)
			}
			var hostkeys []map[string]interface{}
			fmt.Println(string(body))
			err = json.Unmarshal(body, &hostkeys)
			if err != nil {
				t.Fatal(err)
			}
			t.Log(hostkeys, len(hostkeys), test.Expected)

			if len(hostkeys) != test.Expected {
				t.Fatalf("hostkey length is not expected")
			}
		})
	}
}

func TestNoSSHGatewayRouter(t *testing.T) {
	t.Run("TestNoSSHGatewayRouter", func(t *testing.T) {
		router := HostBasedRouter(hostBasedHeader, wsHostSuffix, wsHostNameRegex)
		ingress := HostBasedIngressConfig{
			HTTPAddress:  "8080",
			HTTPSAddress: "9090",
			Header:       "",
		}

		proxy := NewWorkspaceProxy(ingress, config, router, &fakeWsInfoProvider{infos: workspaces}, nil)
		handler, err := proxy.Handler()
		if err != nil {
			t.Fatalf("cannot create proxy handler: %q", err)
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, modifyRequest(httptest.NewRequest("GET", workspaces[0].URL+"_ssh/host_keys", nil),
			addHostHeader,
		))
		resp := rec.Result()
		resp.Body.Close()
		if resp.StatusCode != 401 {
			t.Fatalf("status code should be 401, but got %d", resp.StatusCode)
		}
	})

}

func TestRemoveSensitiveCookies(t *testing.T) {
	var (
		domain            = "test-domain.com"
		sessionCookie     = &http.Cookie{Domain: domain, Name: "_test_domain_com_", Value: "fobar"}
		portAuthCookie    = &http.Cookie{Domain: domain, Name: "_test_domain_com_ws_77f6b236_3456_4b88_8284_81ca543a9d65_port_auth_", Value: "some-token"}
		ownerCookie       = &http.Cookie{Domain: domain, Name: "_test_domain_com_ws_77f6b236_3456_4b88_8284_81ca543a9d65_owner_", Value: "some-other-token"}
		miscCookie        = &http.Cookie{Domain: domain, Name: "some-other-cookie", Value: "I like cookies"}
		invalidCookieName = &http.Cookie{Domain: domain, Name: "foobar[0]", Value: "violates RFC6266"}
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
		{"invalid cookie name", []*http.Cookie{invalidCookieName}, []*http.Cookie{invalidCookieName}},
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

func TestSensitiveCookieHandler(t *testing.T) {
	var (
		domain     = "test-domain.com"
		miscCookie = &http.Cookie{Domain: domain, Name: "some-other-cookie", Value: "I like cookies"}
	)
	tests := []struct {
		Name     string
		Input    string
		Expected string
	}{
		{"no cookies", "", ""},
		{"valid cookie", miscCookie.String(), `some-other-cookie="I like cookies";Domain=test-domain.com`},
		{"invalid cookie", `foobar[0]="violates RFC6266"`, `foobar[0]="violates RFC6266"`},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "http://"+domain, nil)
			if test.Input != "" {
				req.Header.Set("cookie", test.Input)
			}
			rec := httptest.NewRecorder()

			var act string
			sensitiveCookieHandler(domain)(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
				act = r.Header.Get("cookie")
				rw.WriteHeader(http.StatusOK)
			})).ServeHTTP(rec, req)

			if diff := cmp.Diff(test.Expected, act); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}
