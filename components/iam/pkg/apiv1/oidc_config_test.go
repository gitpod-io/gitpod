// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"testing"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	"github.com/gitpod-io/gitpod/components/gitpod-db/go/dbtest"
	v1 "github.com/gitpod-io/gitpod/components/iam-api/go/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
)

func TestOIDCClientConfig_Create(t *testing.T) {

	client := setupOIDCClientConfigService(t)

	_, err := client.CreateClientConfig(context.Background(), &v1.CreateClientConfigRequest{})
	require.Error(t, err)
	require.Equal(t, codes.Unimplemented, status.Code(err))

}

func setupOIDCClientConfigService(t *testing.T) v1.OIDCServiceClient {
	t.Helper()

	dbConn := dbtest.ConnectForTests(t)
	cipher := dbtest.CipherSet(t)

	srv := baseserver.NewForTests(t, baseserver.WithGRPC(
		baseserver.MustUseRandomLocalAddress(t)),
	)

	svc := NewOIDCClientConfigService(dbConn, cipher)
	v1.RegisterOIDCServiceServer(srv.GRPC(), svc)

	t.Cleanup(func() {
		require.NoError(t, srv.Close())
	})

	go func(t *testing.T) {
		require.NoError(t, srv.ListenAndServe())
	}(t)

	conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)

	return v1.NewOIDCServiceClient(conn)
}
