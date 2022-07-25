// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	context "context"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/usage/pkg/controller"
	"time"

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

	ctrl *controller.UsageReconciler

	v1.UnimplementedUsageServiceServer
}

const maxQuerySize = 31 * 24 * time.Hour

func (us *UsageService) ListBilledUsage(ctx context.Context, in *v1.ListBilledUsageRequest) (*v1.ListBilledUsageResponse, error) {
	to := time.Now()
	if in.To != nil {
		to = in.To.AsTime()
	}
	from := to.Add(-maxQuerySize)
	if in.From != nil {
		from = in.From.AsTime()
	}

	if from.After(to) {
		return nil, status.Errorf(codes.InvalidArgument, "Specified From timestamp is after To. Please ensure From is always before To")
	}

	if to.Sub(from) > maxQuerySize {
		return nil, status.Errorf(codes.InvalidArgument, "Maximum range exceeded. Range specified can be at most %s", maxQuerySize.String())
	}

	var order db.Order
	switch in.Order {
	case v1.ListBilledUsageRequest_ORDERING_ASCENDING:
		order = db.AscendingOrder
	default:
		order = db.DescendingOrder
	}

	usageRecords, err := db.ListUsage(ctx, us.conn, db.AttributionID(in.GetAttributionId()), from, to, order)
	if err != nil {
		log.Log.
			WithField("attribution_id", in.AttributionId).
			WithField("from", from).
			WithField("to", to).
			WithError(err).Error("Failed to list usage.")
		return nil, status.Error(codes.Internal, "unable to retrieve billed usage")
	}

	var billedSessions []*v1.BilledSession
	for _, usageRecord := range usageRecords {
		billedSessions = append(billedSessions, usageRecordToBilledUsageProto(usageRecord))
	}

	return &v1.ListBilledUsageResponse{
		Sessions: billedSessions,
	}, nil
}

func (s *UsageService) CollectUsage(ctx context.Context, req *v1.CollectUsageRequest) (*v1.CollectUsageResponse, error) {
	from := req.GetStartTime().AsTime()
	to := req.GetEndTime().AsTime()

	if from.Before(to) {
		return nil, status.Errorf(codes.InvalidArgument, "End time must be after start time")
	}

	_, report, err := s.ctrl.ReconcileTimeRange(ctx, from, to)
	if err != nil {
		log.Log.WithError(err).Error("Failed to reconcile time range.")
		return nil, status.Error(codes.Internal, "failed to reconcile time range")
	}

	var sessions []*v1.BilledSession
	for _, instance := range report {
		sessions = append(sessions, usageRecordToBilledUsageProto(instance))
	}

	return &v1.CollectUsageResponse{
		Sessions: sessions,
	}, nil
}

func NewUsageService(conn *gorm.DB, ctrl *controller.UsageReconciler) *UsageService {
	return &UsageService{
		conn: conn,
		ctrl: ctrl,
	}
}

func usageRecordToBilledUsageProto(usageRecord db.WorkspaceInstanceUsage) *v1.BilledSession {
	var endTime *timestamppb.Timestamp
	if usageRecord.StoppedAt.Valid {
		endTime = timestamppb.New(usageRecord.StoppedAt.Time)
	}
	return &v1.BilledSession{
		AttributionId:  string(usageRecord.AttributionID),
		UserId:         usageRecord.UserID.String(),
		WorkspaceId:    usageRecord.WorkspaceID,
		WorkspaceType:  string(usageRecord.WorkspaceType),
		ProjectId:      usageRecord.ProjectID,
		InstanceId:     usageRecord.InstanceID.String(),
		WorkspaceClass: usageRecord.WorkspaceClass,
		StartTime:      timestamppb.New(usageRecord.StartedAt),
		EndTime:        endTime,
		Credits:        int64(usageRecord.CreditsUsed),
	}
}
