// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/usage/pkg/contentservice"

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

	contentService contentservice.Interface

	reportGenerator *ReportGenerator

	lastReconciliation time.Time

	v1.UnimplementedUsageServiceServer
}

const maxQuerySize = 31 * 24 * time.Hour

func (s *UsageService) ListBilledUsage(ctx context.Context, in *v1.ListBilledUsageRequest) (*v1.ListBilledUsageResponse, error) {
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

	var order db.Order = db.DescendingOrder
	if in.Order == v1.ListBilledUsageRequest_ORDERING_ASCENDING {
		order = db.AscendingOrder
	}

	var limit int64 = 1000
	var page int64 = 0
	var offset int64 = 0
	if in.Pagination != nil {
		limit = in.Pagination.PerPage
		page = in.Pagination.Page
		offset = limit * (int64(math.Max(0, float64(page-1))))
	}

	listUsageResult, err := db.ListUsage(ctx, s.conn, db.AttributionID(in.GetAttributionId()), from, to, order, offset, limit)
	if err != nil {
		log.Log.
			WithField("attribution_id", in.AttributionId).
			WithField("perPage", limit).
			WithField("page", page).
			WithField("from", from).
			WithField("to", to).
			WithError(err).Error("Failed to list usage.")
		return nil, status.Error(codes.Internal, "unable to retrieve billed usage")
	}

	var billedSessions []*v1.BilledSession
	for _, usageRecord := range listUsageResult.UsageRecords {
		var endTime *timestamppb.Timestamp
		if usageRecord.StoppedAt.Valid {
			endTime = timestamppb.New(usageRecord.StoppedAt.Time)
		}
		billedSession := &v1.BilledSession{
			AttributionId:  string(usageRecord.AttributionID),
			UserId:         usageRecord.UserID.String(),
			WorkspaceId:    usageRecord.WorkspaceID,
			WorkspaceType:  string(usageRecord.WorkspaceType),
			ProjectId:      usageRecord.ProjectID,
			InstanceId:     usageRecord.InstanceID.String(),
			WorkspaceClass: usageRecord.WorkspaceClass,
			StartTime:      timestamppb.New(usageRecord.StartedAt),
			EndTime:        endTime,
			Credits:        usageRecord.CreditsUsed,
		}
		billedSessions = append(billedSessions, billedSession)
	}

	var totalPages = int64(math.Ceil(float64(listUsageResult.Count) / float64(limit)))

	var pagination = v1.PaginatedResponse{
		PerPage:    limit,
		Page:       page,
		TotalPages: totalPages,
		Total:      listUsageResult.Count,
	}

	return &v1.ListBilledUsageResponse{
		Sessions:         billedSessions,
		TotalCreditsUsed: listUsageResult.TotalCreditsUsed,
		Pagination:       &pagination,
	}, nil
}

func (s *UsageService) ReconcileUsage(ctx context.Context, req *v1.ReconcileUsageRequest) (*v1.ReconcileUsageResponse, error) {
	from := req.GetStartTime().AsTime()
	to := req.GetEndTime().AsTime()

	if to.Before(from) {
		return nil, status.Errorf(codes.InvalidArgument, "End time must be after start time")
	}

	s.lastReconciliation = time.Now()
	report, err := s.reportGenerator.GenerateUsageReport(ctx, from, to)
	if err != nil {
		log.Log.WithError(err).Error("Failed to reconcile time range.")
		return nil, status.Error(codes.Internal, "failed to reconcile time range")
	}

	err = db.CreateUsageRecords(ctx, s.conn, report.UsageRecords)
	if err != nil {
		log.Log.WithError(err).Error("Failed to persist usage records.")
		return nil, status.Error(codes.Internal, "failed to persist usage records")
	}

	filename := fmt.Sprintf("%s.gz", time.Now().Format(time.RFC3339))
	err = s.contentService.UploadUsageReport(ctx, filename, report)
	if err != nil {
		log.Log.WithError(err).Error("Failed to persist usage report to content service.")
		return nil, status.Error(codes.Internal, "failed to persist usage report to content service")
	}

	return &v1.ReconcileUsageResponse{
		ReportId: filename,
	}, nil
}

func (s *UsageService) GetCostCenter(ctx context.Context, in *v1.GetCostCenterRequest) (*v1.GetCostCenterResponse, error) {
	var attributionIdReq string

	if in.AttributionId == "" {
		return nil, status.Errorf(codes.InvalidArgument, "Empty attributionId")
	}

	attributionIdReq = in.AttributionId

	attributionId, err := db.ParseAttributionID(attributionIdReq)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "Failed to parse attribution ID: %s", err.Error())
	}

	result, err := db.GetCostCenter(ctx, s.conn, db.AttributionID(attributionIdReq))
	if err != nil {
		if errors.Is(err, db.CostCenterNotFound) {
			return nil, status.Errorf(codes.NotFound, "Cost center not found: %s", err.Error())
		}
		return nil, status.Errorf(codes.Internal, "Failed to get cost center %s from DB: %s", in.AttributionId, err.Error())
	}

	return &v1.GetCostCenterResponse{
		CostCenter: &v1.CostCenter{
			AttributionId: string(attributionId),
			SpendingLimit: result.SpendingLimit,
		},
	}, nil
}

func NewUsageService(conn *gorm.DB, reportGenerator *ReportGenerator, contentSvc contentservice.Interface) *UsageService {
	return &UsageService{
		conn:            conn,
		reportGenerator: reportGenerator,
		contentService:  contentSvc,
	}
}

func instancesToUsageRecords(instances []db.WorkspaceInstanceForUsage, pricer *WorkspacePricer, now time.Time) []db.WorkspaceInstanceUsage {
	var usageRecords []db.WorkspaceInstanceUsage

	for _, instance := range instances {
		var stoppedAt sql.NullTime
		if instance.StoppingTime.IsSet() {
			stoppedAt = sql.NullTime{Time: instance.StoppingTime.Time(), Valid: true}
		}

		projectID := ""
		if instance.ProjectID.Valid {
			projectID = instance.ProjectID.String
		}

		usageRecords = append(usageRecords, db.WorkspaceInstanceUsage{
			InstanceID:     instance.ID,
			AttributionID:  instance.UsageAttributionID,
			WorkspaceID:    instance.WorkspaceID,
			ProjectID:      projectID,
			UserID:         instance.OwnerID,
			WorkspaceType:  instance.Type,
			WorkspaceClass: instance.WorkspaceClass,
			StartedAt:      instance.StartedTime.Time(),
			StoppedAt:      stoppedAt,
			CreditsUsed:    pricer.CreditsUsedByInstance(&instance, now),
			GenerationID:   0,
		})
	}

	return usageRecords
}

func (s *UsageService) LastUsageReconcilationTime(ctx context.Context, in *v1.LastUsageReconcilationTimeRequest) (*v1.LastUsageReconcilationTimeResponse, error) {
	return &v1.LastUsageReconcilationTimeResponse{
		Timestamp: timestamppb.New(s.lastReconciliation),
	}, nil
}
