// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/gitpod-io/gitpod/components/public-api/go/client"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/local-app/pkg/config"
	"github.com/google/go-cmp/cmp"
)

type CommandTest struct {
	Name        string
	Commandline []string
	Config      *config.Config
	Expectation CommandTestExpectation
	PrepServer  func(mux *http.ServeMux)
}

type CommandTestExpectation struct {
	Error  string
	Output string
}

func RunCommandTests(t *testing.T, tests []CommandTest) {
	for _, test := range tests {
		name := test.Name
		if name == "" {
			name = strings.Join(test.Commandline, " ")
		}
		t.Run(name, func(t *testing.T) {
			actual := new(bytes.Buffer)

			cfgfn, err := os.CreateTemp("", "local-app-test-cfg-*.json")
			if err != nil {
				t.Fatal(err)
			}
			cfgfn.Close()
			defer os.Remove(cfgfn.Name())

			if test.Config != nil {
				if test.Config.ActiveContext == "test" {
					mux := http.NewServeMux()
					if test.PrepServer != nil {
						test.PrepServer(mux)
					}

					apisrv := httptest.NewServer(mux)
					t.Cleanup(apisrv.Close)

					clnt, err := client.New(client.WithURL(apisrv.URL), client.WithCredentials("hello world"))
					if err != nil {
						t.Fatal(err)
					}
					rootTestingOpts.Client = clnt

					test.Config.Contexts = map[string]*config.ConnectionContext{
						"test": {
							Host:  &config.YamlURL{URL: &url.URL{Scheme: "https", Host: "testing"}},
							Token: "hello world",
						},
					}
				}

				err = config.SaveConfig(cfgfn.Name(), test.Config)
				if err != nil {
					t.Fatal(err)
				}
			}

			rootCmd.SetArgs(test.Commandline)
			rootCmd.SetOut(actual)
			rootCmd.SetErr(actual)
			rootTestingOpts.WriterOut = actual
			rootOpts.ConfigLocation = cfgfn.Name()
			err = rootCmd.Execute()

			var act CommandTestExpectation
			if err != nil {
				act.Error = err.Error()
			}
			act.Output = actual.String()

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("expectation mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

// fixtureWorkspace returns a workspace fixture
func fixtureWorkspace() *v1.Workspace {
	return &v1.Workspace{
		WorkspaceId: "workspaceID",
		OwnerId:     "ownerId",
		ProjectId:   "projectId",
		Context: &v1.WorkspaceContext{
			ContextUrl: "contextUrl",
			Details: &v1.WorkspaceContext_Git_{
				Git: &v1.WorkspaceContext_Git{
					Repository: &v1.WorkspaceContext_Repository{Name: "name", Owner: "owner"},
				},
			},
		},
		Description: "description",
		Status: &v1.WorkspaceStatus{
			Instance: &v1.WorkspaceInstance{
				InstanceId:  "instanceId",
				WorkspaceId: "workspaceId",
				Status: &v1.WorkspaceInstanceStatus{
					StatusVersion: 1,
					Phase:         v1.WorkspaceInstanceStatus_PHASE_RUNNING,
					Url:           "url",
				},
			},
		},
	}
}
