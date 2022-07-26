// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"database/sql"
	"fmt"
	v1 "github.com/gitpod-io/gitpod/usage-api/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/usage/pkg/contentservice"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Reconciler interface {
	Reconcile() error
}

type ReconcilerFunc func() error

func (f ReconcilerFunc) Reconcile() error {
	return f()
}

type UsageReconciler struct {
	nowFunc        func() time.Time
	conn           *gorm.DB
	pricer         *WorkspacePricer
	billingService v1.BillingServiceClient
	contentService contentservice.Interface
}

func NewUsageReconciler(conn *gorm.DB, pricer *WorkspacePricer, billingClient v1.BillingServiceClient, contentService contentservice.Interface) *UsageReconciler {
	return &UsageReconciler{
		conn:           conn,
		pricer:         pricer,
		billingService: billingClient,
		contentService: contentService,
		nowFunc:        time.Now,
	}
}

type UsageReconcileStatus struct {
	StartTime time.Time
	EndTime   time.Time

	WorkspaceInstances        int
	InvalidWorkspaceInstances int
}

func (u *UsageReconciler) Reconcile() (err error) {
	ctx := context.Background()
	now := time.Now().UTC()

	reportUsageReconcileStarted()
	defer func() {
		reportUsageReconcileFinished(time.Since(now), err)
	}()

	startOfCurrentMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	startOfNextMonth := startOfCurrentMonth.AddDate(0, 1, 0)

	status, report, err := u.ReconcileTimeRange(ctx, startOfCurrentMonth, startOfNextMonth)
	if err != nil {
		return err
	}
	log.WithField("usage_reconcile_status", status).Info("Reconcile completed.")

	err = db.CreateUsageRecords(ctx, u.conn, report)
	if err != nil {
		return fmt.Errorf("failed to write usage records to database: %s", err)
	}

	filename := fmt.Sprintf("%s.gz", now.Format(time.RFC3339))
	err = u.contentService.UploadUsageReport(ctx, filename, report)
	if err != nil {
		return fmt.Errorf("failed to upload usage report: %w", err)
	}

	return nil
}

func (u *UsageReconciler) ReconcileTimeRange(ctx context.Context, from, to time.Time) (*UsageReconcileStatus, UsageReport, error) {
	now := u.nowFunc().UTC()
	log.Infof("Gathering usage data from %s to %s", from, to)
	status := &UsageReconcileStatus{
		StartTime: from,
		EndTime:   to,
	}
	instances, invalidInstances, err := u.loadWorkspaceInstances(ctx, from, to)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to load workspace instances: %w", err)
	}
	status.WorkspaceInstances = len(instances)
	status.InvalidWorkspaceInstances = len(invalidInstances)

	if len(invalidInstances) > 0 {
		log.WithField("invalid_workspace_instances", invalidInstances).Errorf("Detected %d invalid instances. These will be skipped in the current run.", len(invalidInstances))
	}
	log.WithField("workspace_instances", instances).Debug("Successfully loaded workspace instances.")

	usageRecords := instancesToUsageRecords(instances, u.pricer, now)

	_, err = u.billingService.UpdateInvoices(ctx, &v1.UpdateInvoicesRequest{
		StartTime: timestamppb.New(from),
		EndTime:   timestamppb.New(to),
		Sessions:  instancesToBilledSessions(usageRecords),
	})
	if err != nil {
		return nil, nil, fmt.Errorf("failed to update invoices: %w", err)
	}

	return status, usageRecords, nil
}

func instancesToUsageRecords(instances []db.WorkspaceInstanceForUsage, pricer *WorkspacePricer, now time.Time) []db.WorkspaceInstanceUsage {
	var usageRecords []db.WorkspaceInstanceUsage

	for _, instance := range instances {
		var stoppedAt sql.NullTime
		if instance.StoppedTime.IsSet() {
			stoppedAt = sql.NullTime{Time: instance.StoppedTime.Time(), Valid: true}
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
			StartedAt:      instance.CreationTime.Time(),
			StoppedAt:      stoppedAt,
			CreditsUsed:    pricer.CreditsUsedByInstance(&instance, now),
			GenerationID:   0,
		})
	}

	return usageRecords
}

func instancesToBilledSessions(instances []db.WorkspaceInstanceUsage) []*v1.BilledSession {
	var sessions []*v1.BilledSession

	for _, instance := range instances {
		var endTime *timestamppb.Timestamp

		if instance.StoppedAt.Valid {
			endTime = timestamppb.New(instance.StoppedAt.Time)
		}

		sessions = append(sessions, &v1.BilledSession{
			AttributionId:  string(instance.AttributionID),
			UserId:         instance.UserID.String(),
			TeamId:         "",
			WorkspaceId:    instance.WorkspaceID,
			WorkspaceType:  string(instance.WorkspaceType),
			ProjectId:      instance.ProjectID,
			InstanceId:     instance.InstanceID.String(),
			WorkspaceClass: instance.WorkspaceClass,
			StartTime:      timestamppb.New(instance.StartedAt),
			EndTime:        endTime,
			Credits:        instance.CreditsUsed,
		})
	}

	return sessions
}

type UsageReport []db.WorkspaceInstanceUsage

type invalidWorkspaceInstance struct {
	reason              string
	workspaceInstanceID uuid.UUID
}

func (u *UsageReconciler) loadWorkspaceInstances(ctx context.Context, from, to time.Time) ([]db.WorkspaceInstanceForUsage, []invalidWorkspaceInstance, error) {
	log.Infof("Gathering usage data from %s to %s", from, to)
	instances, err := db.ListWorkspaceInstancesInRange(ctx, u.conn, from, to)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list instances from db: %w", err)
	}
	log.Infof("Identified %d instances between %s and %s", len(instances), from, to)

	valid, invalid := validateInstances(instances)
	trimmed := trimStartStopTime(valid, from, to)
	return trimmed, invalid, nil
}

func validateInstances(instances []db.WorkspaceInstanceForUsage) (valid []db.WorkspaceInstanceForUsage, invalid []invalidWorkspaceInstance) {
	for _, i := range instances {
		// i is a pointer to the current element, we need to assign it to ensure we're copying the value, not the current pointer.
		instance := i

		// Each instance must have a start time, without it, we do not have a baseline for usage computation.
		if !instance.CreationTime.IsSet() {
			invalid = append(invalid, invalidWorkspaceInstance{
				reason:              "missing creation time",
				workspaceInstanceID: instance.ID,
			})
			continue
		}

		start := instance.CreationTime.Time()

		// Currently running instances do not have a stopped time set, so we ignore these.
		if instance.StoppedTime.IsSet() {
			stop := instance.StoppedTime.Time()
			if stop.Before(start) {
				invalid = append(invalid, invalidWorkspaceInstance{
					reason:              "stop time is before start time",
					workspaceInstanceID: instance.ID,
				})
				continue
			}
		}

		valid = append(valid, instance)
	}
	return valid, invalid
}

// trimStartStopTime ensures that start time or stop time of an instance is never outside of specified start or stop time range.
func trimStartStopTime(instances []db.WorkspaceInstanceForUsage, maximumStart, minimumStop time.Time) []db.WorkspaceInstanceForUsage {
	var updated []db.WorkspaceInstanceForUsage

	for _, instance := range instances {
		if instance.CreationTime.Time().Before(maximumStart) {
			instance.CreationTime = db.NewVarcharTime(maximumStart)
		}

		if instance.StoppedTime.Time().After(minimumStop) {
			instance.StoppedTime = db.NewVarcharTime(minimumStop)
		}

		updated = append(updated, instance)
	}
	return updated
}
