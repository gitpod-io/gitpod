// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/bufbuild/connect-go"
	gitpod_experimental_v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	gitpod_experimental_v1connect "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/v1"
	gitpod_v1connect "github.com/gitpod-io/gitpod/components/public-api/go/v1/v1connect"
	"github.com/google/uuid"

	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

func main() {
	mux := http.NewServeMux()
	mux.Handle(gitpod_v1connect.NewWorkspaceRunnerServiceHandler(&handler{}))
	mux.Handle(gitpod_experimental_v1connect.NewUserServiceHandler(&userHandler{}))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		slog.Info("not found", "path", r.URL.Path)
		http.Error(w, "not found", http.StatusNotFound)
	})
	panic(http.ListenAndServe(
		"localhost:8080",
		// Use h2c so we can serve HTTP/2 without TLS.
		h2c.NewHandler(mux, &http2.Server{}),
	))
}

type handler struct {
	gitpod_v1connect.UnimplementedWorkspaceRunnerServiceHandler

	Workspaces []*v1.RunnerWorkspace
}

func (h *handler) RegisterRunner(ctx context.Context, req *connect.Request[v1.RegisterRunnerRequest]) (*connect.Response[v1.RegisterRunnerResponse], error) {
	runnerID := uuid.Must(uuid.NewRandom()).String()
	slog.Info("register runner", "scope", req.Msg.Scope, "runnerID", runnerID)
	return &connect.Response[v1.RegisterRunnerResponse]{
		Msg: &v1.RegisterRunnerResponse{
			ClusterId: runnerID,
		},
	}, nil
}

func (h *handler) RenewRunnerRegistration(ctx context.Context, req *connect.Request[v1.RenewRunnerRegistrationRequest]) (*connect.Response[v1.RenewRunnerRegistrationResponse], error) {
	return &connect.Response[v1.RenewRunnerRegistrationResponse]{
		Msg: &v1.RenewRunnerRegistrationResponse{},
	}, nil
}

func (h *handler) ListRunnerWorkspaces(ctx context.Context, req *connect.Request[v1.ListRunnerWorkspacesRequest]) (*connect.Response[v1.ListRunnerWorkspacesResponse], error) {
	return &connect.Response[v1.ListRunnerWorkspacesResponse]{
		Msg: &v1.ListRunnerWorkspacesResponse{
			Pagination: &v1.PaginationResponse{Total: int32(len(h.Workspaces))},
			Workspaces: h.Workspaces,
		},
	}, nil
}

func (h *handler) WatchRunnerWorkspaces(ctx context.Context, req *connect.Request[v1.WatchRunnerWorkspacesRequest], srv *connect.ServerStream[v1.WatchRunnerWorkspacesResponse]) error {
	<-ctx.Done()
	return nil
}

func (h *handler) UpdateRunnerWorkspaceStatus(ctx context.Context, req *connect.Request[v1.UpdateRunnerWorkspaceStatusRequest]) (*connect.Response[v1.UpdateRunnerWorkspaceStatusResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("gitpod.v1.WorkspaceRunnerService.UpdateRunnerWorkspaceStatus is not implemented"))
}

type userHandler struct {
	gitpod_experimental_v1connect.UnimplementedUserServiceHandler
}

func (userHandler) GetAuthenticatedUser(context.Context, *connect.Request[gitpod_experimental_v1.GetAuthenticatedUserRequest]) (*connect.Response[gitpod_experimental_v1.GetAuthenticatedUserResponse], error) {
	return &connect.Response[gitpod_experimental_v1.GetAuthenticatedUserResponse]{
		Msg: &gitpod_experimental_v1.GetAuthenticatedUserResponse{
			User: &gitpod_experimental_v1.User{
				Id:   "test",
				Name: "test",
			},
		},
	}, nil
}
