// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package apiv1

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"

	"github.com/gitpod-io/gitpod/common-go/log"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/gorm"
)

var _ v1.UsageServiceServer = (*UsageService)(nil)

type UsageService struct {
	conn              *gorm.DB
	nowFunc           func() time.Time
	pricer            *WorkspacePricer
	costCenterManager *db.CostCenterManager

	v1.UnimplementedUsageServiceServer
}

const maxQuerySize = 300 * 24 * time.Hour

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

	if in.GetPagination().GetPerPage() < 0 {
		return nil, status.Errorf(codes.InvalidArgument, "Number of items perPage needs to be positive (was %d).", in.GetPagination().GetPerPage())
	}

	if in.GetPagination().GetPage() < 0 {
		return nil, status.Errorf(codes.InvalidArgument, "Page number needs to be 0 or greater (was %d).", in.GetPagination().GetPage())
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
	if in.GetPagination().GetPerPage() > 0 {
		perPage = in.GetPagination().GetPerPage()
	}
	var page int64 = 1
	if in.GetPagination().GetPage() > 1 {
		page = in.GetPagination().GetPage()
	}
	var offset = perPage * (page - 1)

	excludeDrafts := false
	listUsageResult, err := db.FindUsage(ctx, s.conn, &db.FindUsageParams{
		AttributionId: db.AttributionID(in.GetAttributionId()),
		From:          from,
		To:            to,
		Order:         order,
		Offset:        offset,
		Limit:         perPage,
		ExcludeDrafts: excludeDrafts,
	})
	logger := log.Log.
		WithField("attribution_id", in.AttributionId).
		WithField("perPage", perPage).
		WithField("page", page).
		WithField("from", from).
		WithField("to", to)
	logger.Info("Fetching usage data")
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

		var workspaceInstanceID string
		if usageRecord.WorkspaceInstanceID != nil {
			workspaceInstanceID = (*usageRecord.WorkspaceInstanceID).String()
		}

		usageDataEntry := &v1.Usage{
			Id:            usageRecord.ID.String(),
			AttributionId: string(usageRecord.AttributionID),
			EffectiveTime: timestamppb.New(usageRecord.EffectiveTime.Time()),
			// convert cents back to full credits
			Credits:             usageRecord.CreditCents.ToCredits(),
			Kind:                kind,
			WorkspaceInstanceId: workspaceInstanceID,
			Draft:               usageRecord.Draft,
			Metadata:            string(usageRecord.Metadata),
		}
		usageData = append(usageData, usageDataEntry)
	}

	usageSummary, err := db.GetUsageSummary(ctx, s.conn,
		db.GetUsageSummaryParams{
			AttributionId: attributionId,
			From:          from,
			To:            to,
			ExcludeDrafts: excludeDrafts,
		},
	)

	if err != nil {
		logger.WithError(err).Error("Failed to fetch usage metadata.")
		return nil, status.Error(codes.Internal, "unable to retrieve usage")
	}
	totalPages := int64(math.Ceil(float64(usageSummary.NumberOfRecords) / float64(perPage)))

	pagination := v1.PaginatedResponse{
		PerPage:    perPage,
		Page:       page,
		TotalPages: totalPages,
		Total:      int64(usageSummary.NumberOfRecords),
	}

	return &v1.ListUsageResponse{
		UsageEntries: usageData,
		CreditsUsed:  usageSummary.CreditCentsUsed.ToCredits(),
		Pagination:   &pagination,
	}, nil
}

func (s *UsageService) GetBalance(ctx context.Context, in *v1.GetBalanceRequest) (*v1.GetBalanceResponse, error) {
	attrId, err := db.ParseAttributionID(in.AttributionId)
	if err != nil {
		return nil, err
	}
	credits, err := db.GetBalance(ctx, s.conn, attrId)
	if err != nil {
		return nil, err
	}
	return &v1.GetBalanceResponse{
		Credits: credits.ToCredits(),
	}, nil
}

func (s *UsageService) GetCostCenter(ctx context.Context, in *v1.GetCostCenterRequest) (*v1.GetCostCenterResponse, error) {
	if in.AttributionId == "" {
		return nil, status.Errorf(codes.InvalidArgument, "Empty attributionId")
	}
	attributionId, err := db.ParseAttributionID(in.AttributionId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "Bad attributionId %s", in.AttributionId)
	}

	result, err := s.costCenterManager.GetOrCreateCostCenter(ctx, attributionId)
	if err != nil {
		return nil, err
	}
	return &v1.GetCostCenterResponse{
		CostCenter: dbCostCenterToAPI(result),
	}, nil
}

func dbCostCenterToAPI(c db.CostCenter) *v1.CostCenter {
	return &v1.CostCenter{
		AttributionId:   string(c.ID),
		SpendingLimit:   c.SpendingLimit,
		BillingStrategy: convertBillingStrategyToAPI(c.BillingStrategy),
		NextBillingTime: timestamppb.New(c.NextBillingTime.Time()),
	}
}

func convertBillingStrategyToDB(in v1.CostCenter_BillingStrategy) db.BillingStrategy {
	if in == v1.CostCenter_BILLING_STRATEGY_STRIPE {
		return db.CostCenter_Stripe
	}
	return db.CostCenter_Other
}

func convertBillingStrategyToAPI(in db.BillingStrategy) v1.CostCenter_BillingStrategy {
	if in == db.CostCenter_Stripe {
		return v1.CostCenter_BILLING_STRATEGY_STRIPE
	}
	return v1.CostCenter_BILLING_STRATEGY_OTHER
}

func (s *UsageService) SetCostCenter(ctx context.Context, in *v1.SetCostCenterRequest) (*v1.SetCostCenterResponse, error) {
	if in.CostCenter == nil {
		return nil, status.Errorf(codes.InvalidArgument, "Empty CostCenter")
	}

	attrID, err := db.ParseAttributionID(in.CostCenter.AttributionId)
	if err != nil {
		return nil, err
	}

	costCenter := db.CostCenter{
		ID:              attrID,
		SpendingLimit:   in.CostCenter.SpendingLimit,
		BillingStrategy: convertBillingStrategyToDB(in.CostCenter.BillingStrategy),
	}
	result, err := s.costCenterManager.UpdateCostCenter(ctx, costCenter)
	if err != nil {
		return nil, err
	}
	return &v1.SetCostCenterResponse{
		CostCenter: dbCostCenterToAPI(result),
	}, nil
}

func (s *UsageService) ResetUsage(ctx context.Context, req *v1.ResetUsageRequest) (*v1.ResetUsageResponse, error) {
	now := time.Now()
	costCentersToUpdate, err := s.costCenterManager.ListLatestCostCentersWithBillingTimeBefore(ctx, db.CostCenter_Other, now)
	if err != nil {
		log.WithError(err).Error("Failed to list cost centers to update.")
		return nil, status.Errorf(codes.Internal, "Failed to identify expired cost centers for Other billing strategy")
	}

	log.Infof("Identified %d expired cost centers at relative to %s", len(costCentersToUpdate), now.Format(time.RFC3339))

	var errors []error
	for _, cc := range costCentersToUpdate {
		_, err = s.costCenterManager.ResetUsage(ctx, cc)
		if err != nil {
			errors = append(errors, err)
		}
	}
	if len(errors) >= 1 {
		log.WithField("errors", errors).Error("Failed to reset usage.")
	}

	return &v1.ResetUsageResponse{}, nil
}

func (s *UsageService) ReconcileUsage(ctx context.Context, req *v1.ReconcileUsageRequest) (*v1.ReconcileUsageResponse, error) {
	from := req.GetFrom().AsTime()
	to := req.GetTo().AsTime()

	logger := log.
		WithField("from", from).
		WithField("to", to)

	if to.Before(from) {
		return nil, status.Errorf(codes.InvalidArgument, "To must not be before From")
	}

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

	// now has to be computed after we've collected all data, to ensure that it's always greater than any of the records we fetch
	now := s.nowFunc()
	inserts, updates, err := reconcileUsage(instances, usageDrafts, s.pricer, now)
	if err != nil {
		logger.WithError(err).Errorf("Failed to reconcile usage with ledger.")
		return nil, status.Errorf(codes.Internal, "Failed to reconcile usage with ledger.")
	}
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

	return &v1.ReconcileUsageResponse{}, nil
}

func reconcileUsage(instances []db.WorkspaceInstanceForUsage, drafts []db.Usage, pricer *WorkspacePricer, now time.Time) (inserts []db.Usage, updates []db.Usage, err error) {

	instancesByID := dedupeWorkspaceInstancesForUsage(instances)

	draftsByWorkspaceID := map[uuid.UUID]db.Usage{}
	for _, draft := range drafts {
		draftsByWorkspaceID[*draft.WorkspaceInstanceID] = draft
	}

	for instanceID, instance := range instancesByID {
		if usage, exists := draftsByWorkspaceID[instanceID]; exists {
			updatedUsage, err := updateUsageFromInstance(instance, usage, pricer, now)
			if err != nil {
				return nil, nil, fmt.Errorf("failed to construct updated usage record: %w", err)
			}
			updates = append(updates, updatedUsage)
			continue
		}

		usage, err := newUsageFromInstance(instance, pricer, now)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to construct usage record: %w", err)
		}
		inserts = append(inserts, usage)
	}

	return inserts, updates, nil
}

const usageDescriptionFromController = "Usage collected by automated system."

func newUsageFromInstance(instance db.WorkspaceInstanceForUsage, pricer *WorkspacePricer, now time.Time) (db.Usage, error) {
	draft := true
	if instance.StoppingTime.IsSet() {
		draft = false
	}

	effectiveTime := now
	if instance.StoppingTime.IsSet() {
		effectiveTime = instance.StoppingTime.Time()
	}

	usage := db.Usage{
		ID:                  uuid.New(),
		AttributionID:       instance.UsageAttributionID,
		Description:         usageDescriptionFromController,
		CreditCents:         db.NewCreditCents(pricer.CreditsUsedByInstance(&instance, now)),
		EffectiveTime:       db.NewVarcharTime(effectiveTime),
		Kind:                db.WorkspaceInstanceUsageKind,
		WorkspaceInstanceID: &instance.ID,
		Draft:               draft,
	}

	startedTime := ""
	if instance.StartedTime.IsSet() {
		startedTime = db.TimeToISO8601(instance.StartedTime.Time())
	}
	endTime := ""
	if instance.StoppingTime.IsSet() {
		endTime = db.TimeToISO8601(instance.StoppingTime.Time())
	}
	err := usage.SetMetadataWithWorkspaceInstance(db.WorkspaceInstanceUsageData{
		WorkspaceId:    instance.WorkspaceID,
		WorkspaceType:  instance.Type,
		WorkspaceClass: instance.WorkspaceClass,
		ContextURL:     instance.ContextURL,
		StartTime:      startedTime,
		EndTime:        endTime,
		UserID:         instance.UserID,
		UserName:       instance.UserName,
		UserAvatarURL:  instance.UserAvatarURL,
	})
	if err != nil {
		return db.Usage{}, fmt.Errorf("failed to serialize workspace instance metadata: %w", err)
	}

	return usage, nil
}

func updateUsageFromInstance(instance db.WorkspaceInstanceForUsage, usage db.Usage, pricer *WorkspacePricer, now time.Time) (db.Usage, error) {
	// We construct a new record to ensure we always take the data from the source of truth - the workspace instance
	updated, err := newUsageFromInstance(instance, pricer, now)
	if err != nil {
		return db.Usage{}, fmt.Errorf("failed to construct updated usage record: %w", err)
	}
	// but we override the ID to the one we already have
	updated.ID = usage.ID

	return updated, nil
}

func collectWorkspaceInstanceIDs(usage []db.Usage) []uuid.UUID {
	var ids []uuid.UUID
	for _, u := range usage {
		ids = append(ids, *u.WorkspaceInstanceID)
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

func NewUsageService(conn *gorm.DB, pricer *WorkspacePricer, costCenterManager *db.CostCenterManager) *UsageService {
	return &UsageService{
		conn:              conn,
		costCenterManager: costCenterManager,
		nowFunc: func() time.Time {
			return time.Now().UTC()
		},
		pricer: pricer,
	}
}
