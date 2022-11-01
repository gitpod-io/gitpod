// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"context"
	"testing"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	v1 "github.com/gitpod-io/gitpod/components/public-api/go/experimental/v1"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

func TestConnectionCreationWasTracked(t *testing.T) {
	// Set up server
	srv := baseserver.NewForTests(t,
		baseserver.WithGRPC(baseserver.MustUseRandomLocalAddress(t)),
	)
	baseserver.StartServerForTests(t, srv)

	// Set up Prometheus registry
	registry := prometheus.NewRegistry()
	registry.MustRegister(proxyConnectionCreateDurationSeconds)

	// Set up Workspace client
	ctx := metadata.AppendToOutgoingContext(context.Background(), "authorization", "some-token")
	conn, _ := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	client := v1.NewWorkspacesServiceClient(conn)

	// Call GetWorkspace
	client.GetWorkspace(ctx, &v1.GetWorkspaceRequest{
		WorkspaceId: "some-ID",
	})

	count, err := testutil.GatherAndCount(registry)
	assert.NoError(t, err)
	assert.Equal(t, 1, count)
}
