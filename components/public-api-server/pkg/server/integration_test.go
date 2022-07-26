// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package server

import (
	"context"
	"net/url"
	"testing"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	v1 "github.com/gitpod-io/gitpod/public-api/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func TestPublicAPIServer_v1_WorkspaceService(t *testing.T) {
	ctx := metadata.AppendToOutgoingContext(context.Background(), "authorization", "some-token")
	srv := baseserver.NewForTests(t,
		baseserver.WithGRPC(baseserver.MustUseRandomLocalAddress(t)),
	)
	registry := prometheus.NewRegistry()

	gitpodAPI, err := url.Parse("wss://main.preview.gitpod-dev.com/api/v1")
	require.NoError(t, err)

	require.NoError(t, register(srv, gitpodAPI, registry))
	baseserver.StartServerForTests(t, srv)

	conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)

	workspaceClient := v1.NewWorkspacesServiceClient(conn)

	_, err = workspaceClient.CreateAndStartWorkspace(ctx, &v1.CreateAndStartWorkspaceRequest{})
	requireErrorStatusCode(t, codes.Unimplemented, err)

	_, err = workspaceClient.StartWorkspace(ctx, &v1.StartWorkspaceRequest{})
	requireErrorStatusCode(t, codes.Unimplemented, err)

	_, err = workspaceClient.GetActiveWorkspaceInstance(ctx, &v1.GetActiveWorkspaceInstanceRequest{})
	requireErrorStatusCode(t, codes.Unimplemented, err)

	_, err = workspaceClient.GetWorkspaceInstanceOwnerToken(ctx, &v1.GetWorkspaceInstanceOwnerTokenRequest{})
	requireErrorStatusCode(t, codes.Unimplemented, err)

	stopWorkspaceStream, err := workspaceClient.StopWorkspace(ctx, &v1.StopWorkspaceRequest{})
	require.NoError(t, err)
	_, err = stopWorkspaceStream.Recv()
	requireErrorStatusCode(t, codes.Unimplemented, err)

	listenWorkspaceStream, err := workspaceClient.ListenToWorkspaceInstance(ctx, &v1.ListenToWorkspaceInstanceRequest{})
	require.NoError(t, err)
	_, err = listenWorkspaceStream.Recv()
	requireErrorStatusCode(t, codes.Unimplemented, err)

	listenImageBuildStream, err := workspaceClient.ListenToImageBuildLogs(ctx, &v1.ListenToImageBuildLogsRequest{})
	require.NoError(t, err)
	_, err = listenImageBuildStream.Recv()
	requireErrorStatusCode(t, codes.Unimplemented, err)
}

func TestPublicAPIServer_v1_PrebuildService(t *testing.T) {
	ctx := context.Background()
	srv := baseserver.NewForTests(t, baseserver.WithGRPC(baseserver.MustUseRandomLocalAddress(t)))
	registry := prometheus.NewRegistry()

	gitpodAPI, err := url.Parse("wss://main.preview.gitpod-dev.com/api/v1")
	require.NoError(t, err)

	require.NoError(t, register(srv, gitpodAPI, registry))

	baseserver.StartServerForTests(t, srv)

	conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)

	prebuildClient := v1.NewPrebuildsServiceClient(conn)

	_, err = prebuildClient.GetPrebuild(ctx, &v1.GetPrebuildRequest{})
	requireErrorStatusCode(t, codes.Unimplemented, err)

	_, err = prebuildClient.GetRunningPrebuild(ctx, &v1.GetRunningPrebuildRequest{})
	requireErrorStatusCode(t, codes.Unimplemented, err)

	listenToStatusStream, err := prebuildClient.ListenToPrebuildStatus(ctx, &v1.ListenToPrebuildStatusRequest{})
	require.NoError(t, err)
	_, err = listenToStatusStream.Recv()
	requireErrorStatusCode(t, codes.Unimplemented, err)

	listenToLogsStream, err := prebuildClient.ListenToPrebuildLogs(ctx, &v1.ListenToPrebuildLogsRequest{})
	require.NoError(t, err)
	_, err = listenToLogsStream.Recv()
	requireErrorStatusCode(t, codes.Unimplemented, err)
}

func requireErrorStatusCode(t *testing.T, expected codes.Code, err error) {
	require.Error(t, err)
	st, ok := status.FromError(err)
	require.True(t, ok)
	require.Equalf(t, expected, st.Code(), "expected: %s but got: %s", expected.String(), st.String())
}
