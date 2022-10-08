// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"context"
	"net/http"
	"net/url"
	"testing"

	"github.com/bufbuild/connect-go"
	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
	"github.com/gitpod-io/gitpod/public-api/v1/v1connect"
	"github.com/stretchr/testify/require"
)

func TestPublicAPIServer_v1_WorkspaceService(t *testing.T) {
	ctx := context.Background()
	srv := baseserver.NewForTests(t,
		baseserver.WithHTTP(baseserver.MustUseRandomLocalAddress(t)),
	)

	gitpodAPI, err := url.Parse("wss://main.preview.gitpod-dev.com/api/v1")
	require.NoError(t, err)

	connPool := &proxy.NoConnectionPool{ServerAPI: gitpodAPI}

	require.NoError(t, register(srv, connPool))
	baseserver.StartServerForTests(t, srv)

	workspaceClient := v1connect.NewWorkspacesServiceClient(http.DefaultClient, srv.HTTPAddress(), connect.WithInterceptors(auth.NewClientInterceptor("some-token")))

	_, err = workspaceClient.CreateAndStartWorkspace(ctx, connect.NewRequest(&v1.CreateAndStartWorkspaceRequest{}))
	requireErrorStatusCode(t, connect.CodeUnimplemented, err)

	_, err = workspaceClient.StartWorkspace(ctx, connect.NewRequest(&v1.StartWorkspaceRequest{}))
	requireErrorStatusCode(t, connect.CodeUnimplemented, err)

	_, err = workspaceClient.GetActiveWorkspaceInstance(ctx, connect.NewRequest(&v1.GetActiveWorkspaceInstanceRequest{}))
	requireErrorStatusCode(t, connect.CodeUnimplemented, err)

	_, err = workspaceClient.GetWorkspaceInstanceOwnerToken(ctx, connect.NewRequest(&v1.GetWorkspaceInstanceOwnerTokenRequest{}))
	requireErrorStatusCode(t, connect.CodeUnimplemented, err)

	stopWorkspaceStream, err := workspaceClient.StopWorkspace(ctx, connect.NewRequest(&v1.StopWorkspaceRequest{}))
	require.NoError(t, err)
	_ = stopWorkspaceStream.Receive()
	err = stopWorkspaceStream.Err()
	requireErrorStatusCode(t, connect.CodeUnimplemented, err)

	listenWorkspaceStream, err := workspaceClient.ListenToWorkspaceInstance(ctx, connect.NewRequest(&v1.ListenToWorkspaceInstanceRequest{}))
	require.NoError(t, err)
	_ = listenWorkspaceStream.Receive()
	err = listenWorkspaceStream.Err()
	requireErrorStatusCode(t, connect.CodeUnimplemented, err)

	listenImageBuildStream, err := workspaceClient.ListenToImageBuildLogs(ctx, connect.NewRequest(&v1.ListenToImageBuildLogsRequest{}))
	require.NoError(t, err)
	_ = listenImageBuildStream.Receive()
	err = listenImageBuildStream.Err()
	requireErrorStatusCode(t, connect.CodeUnimplemented, err)
}

func TestPublicAPIServer_v1_PrebuildService(t *testing.T) {
	ctx := context.Background()
	srv := baseserver.NewForTests(t, baseserver.WithHTTP(baseserver.MustUseRandomLocalAddress(t)))

	gitpodAPI, err := url.Parse("wss://main.preview.gitpod-dev.com/api/v1")
	require.NoError(t, err)

	connPool := &proxy.NoConnectionPool{ServerAPI: gitpodAPI}

	require.NoError(t, register(srv, connPool))

	baseserver.StartServerForTests(t, srv)

	prebuildClient := v1connect.NewPrebuildsServiceClient(http.DefaultClient, srv.HTTPAddress(), connect.WithInterceptors(auth.NewClientInterceptor("some-token")))

	_, err = prebuildClient.GetRunningPrebuild(ctx, connect.NewRequest(&v1.GetRunningPrebuildRequest{}))
	requireErrorStatusCode(t, connect.CodeUnimplemented, err)

	listenToStatusStream, err := prebuildClient.ListenToPrebuildStatus(ctx, connect.NewRequest(&v1.ListenToPrebuildStatusRequest{}))
	require.NoError(t, err)
	_ = listenToStatusStream.Receive()
	err = listenToStatusStream.Err()
	requireErrorStatusCode(t, connect.CodeUnimplemented, err)

	listenToLogsStream, err := prebuildClient.ListenToPrebuildLogs(ctx, connect.NewRequest(&v1.ListenToPrebuildLogsRequest{}))
	require.NoError(t, err)
	_ = listenToLogsStream.Receive()
	err = listenToLogsStream.Err()
	requireErrorStatusCode(t, connect.CodeUnimplemented, err)
}

func requireErrorStatusCode(t *testing.T, expected connect.Code, err error) {
	t.Helper()
	if expected == 0 && err == nil {
		return
	}

	actual := connect.CodeOf(err)
	require.Equal(t, expected, actual, "expected code %s, but got %s from error %v", expected.String(), actual.String(), err)
}

func TestConnectWorkspaceService_RequiresAuth(t *testing.T) {
	srv := baseserver.NewForTests(t,
		baseserver.WithHTTP(baseserver.MustUseRandomLocalAddress(t)),
	)

	gitpodAPI, err := url.Parse("wss://main.preview.gitpod-dev.com/api/v1")
	require.NoError(t, err)

	connPool := &proxy.NoConnectionPool{ServerAPI: gitpodAPI}

	require.NoError(t, register(srv, connPool))

	baseserver.StartServerForTests(t, srv)

	clientWithoutAuth := v1connect.NewWorkspacesServiceClient(http.DefaultClient, srv.HTTPAddress())
	_, err = clientWithoutAuth.GetWorkspace(context.Background(), connect.NewRequest(&v1.GetWorkspaceRequest{WorkspaceId: "123"}))
	require.Error(t, err)
	require.Equal(t, connect.CodeUnauthenticated, connect.CodeOf(err))
}

func TestConnectPrebuildsService_RequiresAuth(t *testing.T) {
	srv := baseserver.NewForTests(t,
		baseserver.WithHTTP(baseserver.MustUseRandomLocalAddress(t)),
	)

	gitpodAPI, err := url.Parse("wss://main.preview.gitpod-dev.com/api/v1")
	require.NoError(t, err)

	connPool := &proxy.NoConnectionPool{ServerAPI: gitpodAPI}

	require.NoError(t, register(srv, connPool))

	baseserver.StartServerForTests(t, srv)

	clientWithoutAuth := v1connect.NewPrebuildsServiceClient(http.DefaultClient, srv.HTTPAddress())
	_, err = clientWithoutAuth.GetPrebuild(context.Background(), connect.NewRequest(&v1.GetPrebuildRequest{PrebuildId: "123"}))
	require.Error(t, err)
	require.Equal(t, connect.CodeUnauthenticated, connect.CodeOf(err))
}
