// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"database/sql"
	"testing"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/db/dbtest"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func TestUsageService_ListBilledUsage(t *testing.T) {
	srv := baseserver.NewForTests(t,
		baseserver.WithGRPC(baseserver.MustUseRandomLocalAddress(t)),
	)

	dbconn := dbtest.ConnectForTests(t)
	v1.RegisterUsageServiceServer(srv.GRPC(), NewUsageService(dbconn))
	baseserver.StartServerForTests(t, srv)

	conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)

	client := v1.NewUsageServiceClient(conn)
	ctx := context.Background()

	const attributionID = "team:123-456-789"
	instanceId := uuid.New()
	startedAt := timestamppb.Now()
	instanceUsages := []db.WorkspaceInstanceUsage{
		{
			InstanceID:    instanceId,
			AttributionID: attributionID,
			StartedAt:     startedAt.AsTime(),
			StoppedAt:     sql.NullTime{},
			CreditsUsed:   0,
			GenerationId:  0,
			Deleted:       false,
		},
	}
	dbtest.CreateWorkspaceInstanceUsageRecords(t, dbconn, instanceUsages...)

	type Expectation struct {
		Code        codes.Code
		InstanceIds []string
	}

	scenarios := []struct {
		name          string
		AttributionID string
		Expect        Expectation
	}{
		{
			name:          "returns one usage record",
			AttributionID: attributionID,
			Expect: Expectation{
				Code:        codes.OK,
				InstanceIds: []string{instanceId.String()},
			},
		},
	}

	for _, scenario := range scenarios {
		t.Run(scenario.name, func(t *testing.T) {
			resp, err := client.ListBilledUsage(ctx, &v1.ListBilledUsageRequest{
				AttributionId: scenario.AttributionID,
			})
			var instanceIds []string
			for _, billedSession := range resp.Sessions {
				instanceIds = append(instanceIds, billedSession.InstanceId)
			}
			require.Equal(t, scenario.Expect.Code, status.Code(err))
			require.Equal(t, scenario.Expect.InstanceIds, instanceIds)
		})
	}
}
