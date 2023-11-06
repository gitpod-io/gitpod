// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"net/http"
	"testing"

	"github.com/bufbuild/connect-go"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	gitpod_experimental_v1connect "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	"github.com/gitpod-io/local-app/pkg/config"
)

func TestWorkspaceListCmd(t *testing.T) {
	RunCommandTests(t, []CommandTest{
		{
			Name:        "no config",
			Commandline: []string{"workspace", "list"},
			Expectation: CommandTestExpectation{Error: config.ErrNoContext.Error()},
		},
		{
			Name:        "test one workspace",
			Commandline: []string{"workspace", "list"},
			Config: &config.Config{
				ActiveContext: "test",
			},
			PrepServer: func(mux *http.ServeMux) {
				mux.Handle(gitpod_experimental_v1connect.NewWorkspacesServiceHandler(&testWorkspaceListCmdWorkspaceSrv{
					Resp: &v1.ListWorkspacesResponse{
						Result: []*v1.Workspace{fixtureWorkspace()},
					},
				}))
			},
			Expectation: CommandTestExpectation{
				Output: "ID          REPOSITORY BRANCH STATUS  \nworkspaceID owner/name        running \n",
			},
		},
		{
			Name:        "test no workspace",
			Commandline: []string{"workspace", "list"},
			Config: &config.Config{
				ActiveContext: "test",
			},
			PrepServer: func(mux *http.ServeMux) {
				mux.Handle(gitpod_experimental_v1connect.NewWorkspacesServiceHandler(&testWorkspaceListCmdWorkspaceSrv{
					Resp: &v1.ListWorkspacesResponse{
						Result: []*v1.Workspace{},
					},
				}))
			},
			Expectation: CommandTestExpectation{
				Output: "ID REPOSITORY BRANCH STATUS \n",
			},
		},
	})
}

type testWorkspaceListCmdWorkspaceSrv struct {
	Resp *v1.ListWorkspacesResponse
	Err  error
	gitpod_experimental_v1connect.UnimplementedWorkspacesServiceHandler
}

func (srv testWorkspaceListCmdWorkspaceSrv) ListWorkspaces(context.Context, *connect.Request[v1.ListWorkspacesRequest]) (*connect.Response[v1.ListWorkspacesResponse], error) {
	if srv.Err != nil {
		return nil, srv.Err
	}
	return &connect.Response[v1.ListWorkspacesResponse]{Msg: srv.Resp}, nil
}
