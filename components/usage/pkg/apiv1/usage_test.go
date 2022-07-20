// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"database/sql"
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
	"testing"
	"time"
)

func TestUsageService_ListBilledUsage(t *testing.T) {
	ctx := context.Background()

	attributionID := db.NewTeamAttributionID(uuid.New().String())

	type Expectation struct {
		Code        codes.Code
		InstanceIds []string
	}

	type Scenario struct {
		name      string
		Instances []db.WorkspaceInstanceUsage
		Request   *v1.ListBilledUsageRequest
		Expect    Expectation
	}

	scenarios := []Scenario{
		{
			name:      "fails when From is after To",
			Instances: nil,
			Request: &v1.ListBilledUsageRequest{
				AttributionId: string(attributionID),
				From:          timestamppb.New(time.Date(2022, 07, 1, 13, 0, 0, 0, time.UTC)),
				To:            timestamppb.New(time.Date(2022, 07, 1, 12, 0, 0, 0, time.UTC)),
			},
			Expect: Expectation{
				Code:        codes.InvalidArgument,
				InstanceIds: nil,
			},
		},
		{
			name:      "fails when time range is greater than 31 days",
			Instances: nil,
			Request: &v1.ListBilledUsageRequest{
				AttributionId: string(attributionID),
				From:          timestamppb.New(time.Date(2022, 7, 1, 13, 0, 0, 0, time.UTC)),
				To:            timestamppb.New(time.Date(2022, 8, 1, 13, 0, 1, 0, time.UTC)),
			},
			Expect: Expectation{
				Code:        codes.InvalidArgument,
				InstanceIds: nil,
			},
		},
		(func() Scenario {
			start := time.Date(2022, 07, 1, 13, 0, 0, 0, time.UTC)
			attrID := db.NewTeamAttributionID(uuid.New().String())
			var instances []db.WorkspaceInstanceUsage
			var instanceIDs []string
			for i := 0; i < 10; i++ {
				instance := dbtest.NewWorkspaceInstanceUsage(t, db.WorkspaceInstanceUsage{
					AttributionID: attrID,
					StartedAt:     start.Add(time.Duration(i) * 24 * time.Hour),
					StoppedAt: sql.NullTime{
						Time:  start.Add(time.Duration(i)*24*time.Hour + time.Hour),
						Valid: true,
					},
				})
				instances = append(instances, instance)

				instanceIDs = append(instanceIDs, instance.InstanceID.String())
			}

			return Scenario{
				name:      "filters results to specified time range",
				Instances: instances,
				Request: &v1.ListBilledUsageRequest{
					AttributionId: string(attrID),
					From:          timestamppb.New(start),
					To:            timestamppb.New(start.Add(5 * 24 * time.Hour)),
				},
				Expect: Expectation{
					Code:        codes.OK,
					InstanceIds: instanceIDs[0:5],
				},
			}
		})(),
	}

	for _, scenario := range scenarios {
		t.Run(scenario.name, func(t *testing.T) {
			dbconn := dbtest.ConnectForTests(t)
			dbtest.CreateWorkspaceInstanceUsageRecords(t, dbconn, scenario.Instances...)

			srv := baseserver.NewForTests(t,
				baseserver.WithGRPC(baseserver.MustUseRandomLocalAddress(t)),
			)

			v1.RegisterUsageServiceServer(srv.GRPC(), NewUsageService(dbconn))
			baseserver.StartServerForTests(t, srv)

			conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
			require.NoError(t, err)

			client := v1.NewUsageServiceClient(conn)

			resp, err := client.ListBilledUsage(ctx, scenario.Request)
			require.Equal(t, scenario.Expect.Code, status.Code(err))

			if err != nil {
				return
			}

			var instanceIds []string
			for _, billedSession := range resp.Sessions {
				instanceIds = append(instanceIds, billedSession.InstanceId)
			}

			require.Equal(t, scenario.Expect.InstanceIds, instanceIds)
		})
	}
}
