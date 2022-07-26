// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/gitpod-io/gitpod/usage/pkg/stripe"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"math"
)

func NewBillingService(sc *stripe.Client) *BillingService {
	return &BillingService{
		sc: sc,
	}
}

type BillingService struct {
	sc *stripe.Client

	v1.UnimplementedBillingServiceServer
}

func (s *BillingService) UpdateInvoices(ctx context.Context, req *v1.UpdateInvoicesRequest) (*v1.UpdateInvoicesResponse, error) {
	creditsPerTeam, err := sessionsToCreditReportForTeams(req.GetSessions())
	if err != nil {
		log.Log.WithError(err).Error("Failed to generate credit report for teams.")
		return nil, status.Errorf(codes.InvalidArgument, "Failed to generate credit report")
	}

	err = s.sc.UpdateUsage(creditsPerTeam)
	if err != nil {
		log.Log.WithError(err).Errorf("Failed to update stripe usage")
		return nil, status.Errorf(codes.Internal, "failed to update stripe usage")
	}

	return &v1.UpdateInvoicesResponse{}, nil
}

func sessionsToCreditReportForTeams(sessions []*v1.BilledSession) (map[string]int64, error) {
	creditsPerTeamID := map[string]int64{}

	for _, instance := range sessions {
		attribution, err := db.ParseAttributionID(instance.AttributionId)
		if err != nil {
			return nil, fmt.Errorf("invalid attribution: %w", err)
		}

		entity, id := attribution.Values()
		if entity != db.AttributionEntity_Team {
			continue
		}

		if _, ok := creditsPerTeamID[id]; !ok {
			creditsPerTeamID[id] = 0
		}
		creditsPerTeamID[id] += instance.Credits
	}

	// Round credits up once we've accumulated all of them
	for team, credits := range creditsPerTeamID {
		creditsPerTeamID[team] = int64(math.Ceil(float64(credits)))
	}
	return creditsPerTeamID, nil
}

type UnimplementedBillingService struct {
	v1.UnimplementedBillingServiceServer
}
