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
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1/v1connect"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/auth"
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
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
