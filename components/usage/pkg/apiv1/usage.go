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

	"github.com/google/uuid"

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
	conn    *gorm.DB
	nowFunc func() time.Time
	pricer  *WorkspacePricer

	contentService contentservice.Interface

	reportGenerator *ReportGenerator

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

func (s *UsageService) ListUsage(ctx context.Context, in *v1.ListUsageRequest) (*v1.ListUsageResponse, error) {
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

	if in.Pagination.PerPage < 0 {
		return nil, status.Errorf(codes.InvalidArgument, "Number of items perPage needs to be positive (was %d).", in.Pagination.PerPage)
	}

	if in.Pagination.Page < 0 {
		return nil, status.Errorf(codes.InvalidArgument, "Page number needs to be 0 or greater (was %d).", in.Pagination.Page)
	}

	attributionId, err := db.ParseAttributionID(in.AttributionId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "AttributionID '%s' couldn't be parsed (error: %s).", in.AttributionId, err)
	}

	order := db.DescendingOrder
	if in.Order == v1.ListUsageRequest_ORDERING_ASCENDING {
		order = db.AscendingOrder
	}

	var perPage int64 = 50
	if in.Pagination.PerPage > 0 {
		perPage = in.Pagination.PerPage
	}
	var page int64 = in.Pagination.Page
	var offset int64 = perPage * page

	listUsageResult, err := db.FindUsage(ctx, s.conn, &db.FindUsageParams{
		AttributionId: db.AttributionID(in.GetAttributionId()),
		From:          from,
		To:            to,
		Order:         order,
		Offset:        offset,
		Limit:         perPage,
	})
	logger := log.Log.
		WithField("attribution_id", in.AttributionId).
		WithField("perPage", perPage).
		WithField("page", page).
		WithField("from", from).
		WithField("to", to)
	if err != nil {
		logger.WithError(err).Error("Failed to fetch usage.")
		return nil, status.Error(codes.Internal, "unable to retrieve usage")
	}

	var usageData []*v1.Usage
	for _, usageRecord := range listUsageResult {
		kind := v1.Usage_KIND_WORKSPACE_INSTANCE
		if usageRecord.Kind == db.InvoiceUsageKind {
			kind = v1.Usage_KIND_INVOICE
		}
		usageDataEntry := &v1.Usage{
			Id:            usageRecord.ID.String(),
			AttributionId: string(usageRecord.AttributionID),
			EffectiveTime: timestamppb.New(usageRecord.EffectiveTime.Time()),
			// convert cents back to full credits
			Credits:             usageRecord.CreditCents.ToCredits(),
			Kind:                kind,
			WorkspaceInstanceId: usageRecord.WorkspaceInstanceID.String(),
			Draft:               usageRecord.Draft,
			Metadata:            string(usageRecord.Metadata),
		}
		usageData = append(usageData, usageDataEntry)
	}

	usageSummary, err := db.GetUsageSummary(ctx, s.conn,
		db.AttributionID(string(attributionId)),
		from,
		to,
		true,
	)

	if err != nil {
		logger.WithError(err).Error("Failed to fetch usage metadata.")
		return nil, status.Error(codes.Internal, "unable to retrieve usage")
	}
	totalPages := int64(math.Ceil(float64(usageSummary.NumRecordsInRange) / float64(perPage)))

	pagination := v1.PaginatedResponse{
		PerPage:    perPage,
		Page:       page,
		TotalPages: totalPages,
		Total:      int64(usageSummary.NumRecordsInRange),
	}

	return &v1.ListUsageResponse{
		UsageEntries:         usageData,
		CreditBalanceAtStart: float64(usageSummary.CreditCentsBalanceAtStart) / 100,
		CreditBalanceAtEnd:   float64(usageSummary.CreditCentsBalanceAtEnd) / 100,
		Pagination:           &pagination,
	}, nil
}

func (s *UsageService) ReconcileUsage(ctx context.Context, req *v1.ReconcileUsageRequest) (*v1.ReconcileUsageResponse, error) {
	from := req.GetStartTime().AsTime()
	to := req.GetEndTime().AsTime()

	if to.Before(from) {
		return nil, status.Errorf(codes.InvalidArgument, "End time must be after start time")
	}

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

func (s *UsageService) ReconcileUsageWithLedger(ctx context.Context, req *v1.ReconcileUsageWithLedgerRequest) (*v1.ReconcileUsageWithLedgerResponse, error) {
	from := req.GetFrom().AsTime()
	to := req.GetTo().AsTime()

	logger := log.
		WithField("from", from).
		WithField("to", to)

	if to.Before(from) {
		return nil, status.Errorf(codes.InvalidArgument, "To must not be before From")
	}

	now := s.nowFunc()

	var instances []db.WorkspaceInstanceForUsage
	stopped, err := db.FindStoppedWorkspaceInstancesInRange(ctx, s.conn, from, to)
	if err != nil {
		logger.WithError(err).Errorf("Failed to find stopped workspace instances.")
		return nil, status.Errorf(codes.Internal, "failed to query for stopped instances")
	}
	logger.Infof("Found %d stopped workspace instances in range.", len(stopped))
	instances = append(instances, stopped...)

	running, err := db.FindRunningWorkspaceInstances(ctx, s.conn)
	if err != nil {
		logger.WithError(err).Errorf("Failed to find running workspace instances.")
		return nil, status.Errorf(codes.Internal, "failed to query for running instances")
	}
	logger.Infof("Found %d running workspaces since the beginning of time.", len(running))
	instances = append(instances, running...)

	usageDrafts, err := db.FindAllDraftUsage(ctx, s.conn)
	if err != nil {
		logger.WithError(err).Errorf("Failed to find all draft usage records.")
		return nil, status.Errorf(codes.Internal, "failed to find all draft usage records")
	}
	logger.Infof("Found %d draft usage records.", len(usageDrafts))

	instancesWithUsageInDraft, err := db.FindWorkspaceInstancesByIds(ctx, s.conn, collectWorkspaceInstanceIDs(usageDrafts))
	if err != nil {
		logger.WithError(err).Errorf("Failed to find workspace instances for usage records in draft.")
		return nil, status.Errorf(codes.Internal, "failed to find workspace instances for usage records in draft state")
	}
	logger.Infof("Found %d workspaces instances for usage records in draft.", len(instancesWithUsageInDraft))
	instances = append(instances, instancesWithUsageInDraft...)

	inserts, updates := reconcileUsageWithLedger(instances, usageDrafts, s.pricer, now)
	logger.Infof("Identified %d inserts and %d updates against usage records.", len(inserts), len(updates))

	if len(inserts) > 0 {
		err = db.InsertUsage(ctx, s.conn, inserts...)
		if err != nil {
			logger.WithError(err).Errorf("Failed to insert %d usage records into the database.", len(inserts))
			return nil, status.Errorf(codes.Internal, "Failed to insert usage records into the database.")
		}
		logger.Infof("Inserted %d new Usage records into the database.", len(inserts))
	}

	if len(updates) > 0 {
		err = db.UpdateUsage(ctx, s.conn, updates...)
		if err != nil {
			logger.WithError(err).Error("Failed to update usage records in the database.")
			return nil, status.Errorf(codes.Internal, "Failed to update usage records in the database.")
		}
		logger.Infof("Updated %d Usage records in the database.", len(updates))
	}

	return &v1.ReconcileUsageWithLedgerResponse{}, nil
}

func reconcileUsageWithLedger(instances []db.WorkspaceInstanceForUsage, drafts []db.Usage, pricer *WorkspacePricer, now time.Time) (inserts []db.Usage, updates []db.Usage) {

	instancesByID := dedupeWorkspaceInstancesForUsage(instances)

	draftsByWorkspaceID := map[uuid.UUID]db.Usage{}
	for _, draft := range drafts {
		draftsByWorkspaceID[draft.WorkspaceInstanceID] = draft
	}

	for instanceID, instance := range instancesByID {
		if usage, exists := draftsByWorkspaceID[instanceID]; exists {
			updates = append(updates, updateUsageFromInstance(instance, usage, pricer, now))
			continue
		}

		inserts = append(inserts, newUsageFromInstance(instance, pricer, now))
	}

	return inserts, updates
}

const usageDescriptionFromController = "Usage collected by automated system."

func newUsageFromInstance(instance db.WorkspaceInstanceForUsage, pricer *WorkspacePricer, now time.Time) db.Usage {
	draft := true
	if instance.StoppingTime.IsSet() {
		draft = false
	}

	effectiveTime := now
	if instance.StoppingTime.IsSet() {
		effectiveTime = instance.StoppingTime.Time()
	}

	return db.Usage{
		ID:                  uuid.New(),
		AttributionID:       instance.UsageAttributionID,
		Description:         usageDescriptionFromController,
		CreditCents:         db.NewCreditCents(pricer.CreditsUsedByInstance(&instance, now)),
		EffectiveTime:       db.NewVarcharTime(effectiveTime),
		Kind:                db.WorkspaceInstanceUsageKind,
		WorkspaceInstanceID: instance.ID,
		Draft:               draft,
		Metadata:            nil,
	}
}

func updateUsageFromInstance(instance db.WorkspaceInstanceForUsage, usage db.Usage, pricer *WorkspacePricer, now time.Time) db.Usage {
	// We construct a new record to ensure we always take the data from the source of truth - the workspace instance
	updated := newUsageFromInstance(instance, pricer, now)
	// but we override the ID to the one we already have
	updated.ID = usage.ID

	return updated
}

func collectWorkspaceInstanceIDs(usage []db.Usage) []uuid.UUID {
	var ids []uuid.UUID
	for _, u := range usage {
		ids = append(ids, u.WorkspaceInstanceID)
	}
	return ids
}

func dedupeWorkspaceInstancesForUsage(instances []db.WorkspaceInstanceForUsage) map[uuid.UUID]db.WorkspaceInstanceForUsage {
	set := map[uuid.UUID]db.WorkspaceInstanceForUsage{}
	for _, instance := range instances {
		set[instance.ID] = instance
	}
	return set
}

func NewUsageService(conn *gorm.DB, reportGenerator *ReportGenerator, contentSvc contentservice.Interface, pricer *WorkspacePricer) *UsageService {
	return &UsageService{
		conn: conn,
		nowFunc: func() time.Time {
			return time.Now().UTC()
		},
		pricer:          pricer,
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
