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
	"github.com/gitpod-io/gitpod/public-api-server/pkg/proxy"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
	"github.com/gitpod-io/gitpod/public-api/v1/v1connect"
	"github.com/stretchr/testify/require"
)

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
