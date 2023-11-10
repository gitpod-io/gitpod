// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package helper

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/components/public-api/go/client"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	gitpod_experimental_v1connect "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	"github.com/gitpod-io/local-app/pkg/prettyprint"
	"github.com/google/go-cmp/cmp"
)

func TestObserveWorkspaceUntilStarted(t *testing.T) {
	workspaceWithStatus := func(id string, phase v1.WorkspaceInstanceStatus_Phase) *v1.Workspace {
		return &v1.Workspace{
			WorkspaceId: id,
			Status: &v1.WorkspaceStatus{
				Instance: &v1.WorkspaceInstance{
					WorkspaceId: id,
					Status: &v1.WorkspaceInstanceStatus{
						Phase: phase,
					},
				},
			},
		}
	}

	type Expectation struct {
		Error           string
		SystemException bool
	}
	tests := []struct {
		Name        string
		Expectation Expectation
		PrepServer  func(mux *http.ServeMux)
		WorkspaceID string
	}{
		{
			Name: "stream retry",
			PrepServer: func(mux *http.ServeMux) {
				mux.Handle(gitpod_experimental_v1connect.NewWorkspacesServiceHandler(&TestWorkspaceService{
					Workspaces: []*v1.Workspace{
						workspaceWithStatus("workspaceID", v1.WorkspaceInstanceStatus_PHASE_PENDING),
						workspaceWithStatus("workspaceID", v1.WorkspaceInstanceStatus_PHASE_CREATING),
						nil,
						workspaceWithStatus("workspaceID", v1.WorkspaceInstanceStatus_PHASE_RUNNING),
					},
				}))
			},
		},
		{
			Name: "stream ends early",
			PrepServer: func(mux *http.ServeMux) {
				mux.Handle(gitpod_experimental_v1connect.NewWorkspacesServiceHandler(&TestWorkspaceService{
					Workspaces: []*v1.Workspace{
						workspaceWithStatus("workspaceID", v1.WorkspaceInstanceStatus_PHASE_CREATING),
					},
				}))
			},
			Expectation: Expectation{
				Error:           "workspace stream ended unexpectedly",
				SystemException: true,
			},
		},
		{
			Name: "workspace starts",
			PrepServer: func(mux *http.ServeMux) {
				mux.Handle(gitpod_experimental_v1connect.NewWorkspacesServiceHandler(&TestWorkspaceService{
					Workspaces: []*v1.Workspace{
						workspaceWithStatus("workspaceID", v1.WorkspaceInstanceStatus_PHASE_PENDING),
						workspaceWithStatus("workspaceID", v1.WorkspaceInstanceStatus_PHASE_CREATING),
						workspaceWithStatus("workspaceID", v1.WorkspaceInstanceStatus_PHASE_RUNNING),
					},
				}))
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var act Expectation

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

			_, err = ObserveWorkspaceUntilStarted(context.Background(), clnt, test.WorkspaceID)
			if err != nil {
				act.Error = err.Error()
				_, act.SystemException = err.(*prettyprint.ErrSystemException)
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("ObserveWorkspaceUntilStarted() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

type TestWorkspaceService struct {
	gitpod_experimental_v1connect.WorkspacesServiceHandler

	Workspaces []*v1.Workspace
	Pos        int
}

func (srv *TestWorkspaceService) GetWorkspace(context.Context, *connect.Request[v1.GetWorkspaceRequest]) (*connect.Response[v1.GetWorkspaceResponse], error) {
	if srv.Pos >= len(srv.Workspaces) {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("not found"))
	}

	resp := &connect.Response[v1.GetWorkspaceResponse]{
		Msg: &v1.GetWorkspaceResponse{
			Result: srv.Workspaces[srv.Pos],
		},
	}
	srv.Pos++
	return resp, nil
}

func (srv *TestWorkspaceService) StreamWorkspaceStatus(ctx context.Context, req *connect.Request[v1.StreamWorkspaceStatusRequest], resp *connect.ServerStream[v1.StreamWorkspaceStatusResponse]) error {
	if srv.Pos >= len(srv.Workspaces) {
		return nil
	}
	if srv.Workspaces[srv.Pos] == nil {
		srv.Pos++
		return nil
	}

	for ; srv.Pos < len(srv.Workspaces); srv.Pos++ {
		ws := srv.Workspaces[srv.Pos]
		if ws == nil {
			return nil
		}
		err := resp.Send(&v1.StreamWorkspaceStatusResponse{
			Result: ws.Status,
		})
		if err != nil {
			return err
		}
	}
	return nil
}
