// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"testing"
	"time"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/gitpod-io/gitpod/usage/pkg/stripe"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	timestamppb "google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"
)

func TestServerCanReceiveLargeMessages(t *testing.T) {
	srv := baseserver.NewForTests(t,
		baseserver.WithGRPC(baseserver.MustUseRandomLocalAddress(t)),
	)
	conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)

	usageClient := v1.NewUsageServiceClient(conn)
	billingClient := v1.NewBillingServiceClient(conn)

	v1.RegisterBillingServiceServer(srv.GRPC(), NewBillingService(&stripe.Client{}, time.Time{}, &gorm.DB{}, usageClient, billingClient))
	baseserver.StartServerForTests(t, srv)

	client := v1.NewBillingServiceClient(conn)

	_, err = client.UpdateInvoices(context.Background(), &v1.UpdateInvoicesRequest{
		Sessions: getBilledSessions(),
	})

	require.NoError(t, err)
}

func getBilledSessions() (sessions []*v1.BilledSession) {
	for i := 0; i < 900000; i++ {
		sessions = append(sessions, &v1.BilledSession{
			AttributionId:     "user:1234",
			UserId:            "1234",
			TeamId:            "",
			WorkspaceId:       "",
			WorkspaceType:     "",
			ProjectId:         "",
			InstanceId:        "",
			WorkspaceClass:    "",
			StartTime:         &timestamppb.Timestamp{},
			EndTime:           &timestamppb.Timestamp{},
			CreditsDeprecated: 0,
			Credits:           0,
		})
	}
	return
}
