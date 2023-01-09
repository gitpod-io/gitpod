// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestBuildChildProcEnv(t *testing.T) {
	withBaseline := func(i []string) []string {
		return append(i,
			"SUPERVISOR_ADDR=localhost:8080",
			"HOME=/home/gitpod",
			"USER=gitpod",
		)
	}

	tests := []struct {
		Name        string
		Input       []string
		Expectation []string
		OTS         string
		Assert      func(t *testing.T, act []string)
	}{
		{
			Name:        "empty set",
			Input:       []string{},
			Expectation: withBaseline(nil),
		},
		{
			Name:        "= in value",
			Input:       []string{"FOO=BAR=BAZ"},
			Expectation: withBaseline([]string{"FOO=BAR=BAZ"}),
		},
		{
			Name: "override baseline",
			Input: []string{
				"SUPERVISOR_ADDR=foobar",
				"HOME=foobar",
				"USER=foobar",
			},
			Expectation: withBaseline(nil),
		},
		{
			Name:        "removes blacklisted vars",
			Input:       []string{"GITPOD_TOKENS=foobar"},
			Expectation: withBaseline(nil),
		},
		{
			Name:        "invalid env var",
			Input:       []string{"FOOBAR"},
			Expectation: withBaseline(nil),
		},
		{
			// for testing purposes we can pass a set of envvars to buildChildProcEnv.
			// When a caller passes nil, buildChildProcEnv calls os.Environ().
			// This test case ensures we make that call and don't break on behaviour introduced
			// just for testing.
			Name:  "os.Environ",
			Input: nil,
			Assert: func(t *testing.T, act []string) {
				// if we've called os.Environ, we expect PATH to be present
				var (
					hasPath bool
					path    = fmt.Sprintf("PATH=%s", os.Getenv("PATH"))
				)
				for _, e := range act {
					if e == path {
						hasPath = true
						break
					}
				}
				if !hasPath {
					t.Errorf("no PATH envvar found - probably did not call os.Environ()")
				}
			},
		},
		{
			Name:        "ots",
			Input:       []string{},
			OTS:         `[{"name":"foo","value":"bar"},{"name":"GITPOD_TOKENS","value":"foobar"}]`,
			Expectation: []string{"HOME=/home/gitpod", "SUPERVISOR_ADDR=localhost:8080", "USER=gitpod", "foo=bar"},
		},
		{
			Name:        "failed ots",
			Input:       []string{},
			OTS:         `invalid json`,
			Expectation: []string{"HOME=/home/gitpod", "SUPERVISOR_ADDR=localhost:8080", "USER=gitpod"},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			assert := test.Assert
			if assert == nil {
				assert = func(t *testing.T, act []string) {
					exp := test.Expectation
					sort.Strings(act)
					sort.Strings(exp)
					if diff := cmp.Diff(exp, act); diff != "" {
						t.Errorf("unexpected buildChildProcEnv (-want +got):\n%s", diff)
					}
				}
			}

			cfg := &Config{StaticConfig: StaticConfig{APIEndpointPort: 8080}}
			if test.OTS != "" {
				srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					w.Header().Set("Content-Type", "application/json")
					w.Write([]byte(test.OTS))
				}))
				cfg.EnvvarOTS = srv.URL
			}

			act := buildChildProcEnv(cfg, test.Input, false)
			assert(t, act)
		})
	}
}

func TestIsBlacklistedEnvvar(t *testing.T) {
	tests := []struct {
		Name        string
		Input       string
		Expectation bool
	}{
		{Name: "deprecated theia envvars", Input: "THEIA_SUPERVISOR_FOOBAR", Expectation: true},
		{Name: "gitpod tokens", Input: "GITPOD_TOKENS", Expectation: true},
		{Name: "gitpod tokens child", Input: "GITPOD_TOKENS_GITHUB", Expectation: true},
		{Name: "kubernetes services", Input: "KUBERNETES_SERVICE_FOOBAR", Expectation: true},
		{Name: "kubernetes service ports", Input: "KUBERNETES_PORT_FOOBAR", Expectation: true},
		{Name: "something with spaces", Input: "   I_DO_NOT_UNDERSTAND", Expectation: true},
		{Name: "path", Input: "PATH", Expectation: false},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			act := isBlacklistedEnvvar(test.Input)
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected isBlacklistedEnvvar (-want +got):\n%s", diff)
			}
		})
	}
}
