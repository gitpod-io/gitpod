// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"testing"

	"github.com/gitpod-io/gitpod/common-go/baseserver"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/testing/protocmp"
)

func TestUsageService_GetBilledUsage(t *testing.T) {
	const (
		attributionID = "team:123-456-789"
	)

	srv := baseserver.NewForTests(t,
		baseserver.WithGRPC(baseserver.MustUseRandomLocalAddress(t)),
	)

	v1.RegisterUsageServiceServer(srv.GRPC(), NewUsageService())
	baseserver.StartServerForTests(t, srv)

	conn, err := grpc.Dial(srv.GRPCAddress(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)

	client := v1.NewUsageServiceClient(conn)
	ctx := context.Background()

	type Expectation struct {
		Code     codes.Code
		Response *v1.GetBilledUsageResponse
	}

	scenarios := []struct {
		name          string
		AttributionID string
		Expect        Expectation
	}{
		{
			name:          "returns a dummy response",
			AttributionID: attributionID,
			Expect: Expectation{
				Code: codes.OK,
				Response: &v1.GetBilledUsageResponse{
					Sessions: []*v1.BilledSession{},
				},
			},
		},
	}

	for _, scenario := range scenarios {
		t.Run(scenario.name, func(t *testing.T) {
			resp, err := client.GetBilledUsage(ctx, &v1.GetBilledUsageRequest{
				AttributionId: scenario.AttributionID,
			})
			if diff := cmp.Diff(scenario.Expect, Expectation{
				Code:     status.Code(err),
				Response: resp,
			}, protocmp.Transform()); diff != "" {
				t.Errorf("unexpected difference:\n%v", diff)
			}
		})

	}

}
