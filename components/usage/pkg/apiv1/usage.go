// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	context "context"

	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"
)

var _ v1.UsageServiceServer = (*UsageService)(nil)

type UsageService struct {
	conn *gorm.DB
	v1.UnimplementedUsageServiceServer
}

func (us *UsageService) ListBilledUsage(ctx context.Context, in *v1.ListBilledUsageRequest) (*v1.ListBilledUsageResponse, error) {
	usageRecords, err := db.ListUsage(ctx, us.conn, db.AttributionID(in.GetAttributionId()))
	if err != nil {
		return nil, status.Error(codes.Internal, "unable to retrieve billed usage")
	}

	var billedSessions []*v1.BilledSession
	for _, usageRecord := range usageRecords {
		var endTime *timestamppb.Timestamp
		if usageRecord.StoppedAt.Valid {
			endTime = timestamppb.New(usageRecord.StoppedAt.Time)
		}
		billedSession := &v1.BilledSession{
			AttributionId:  string(usageRecord.AttributionID),
			UserId:         usageRecord.UserID,
			WorkspaceId:    usageRecord.WorkspaceID,
			WorkspaceType:  string(usageRecord.WorkspaceType),
			ProjectId:      usageRecord.ProjectID,
			InstanceId:     usageRecord.InstanceID.String(),
			WorkspaceClass: usageRecord.WorkspaceClass,
			StartTime:      timestamppb.New(usageRecord.StartedAt),
			EndTime:        endTime,
			Credits:        int64(usageRecord.CreditsUsed),
		}
		billedSessions = append(billedSessions, billedSession)
	}

	return &v1.ListBilledUsageResponse{
		Sessions: billedSessions,
	}, nil
}

func NewUsageService(conn *gorm.DB) *UsageService {
	return &UsageService{conn: conn}
}
