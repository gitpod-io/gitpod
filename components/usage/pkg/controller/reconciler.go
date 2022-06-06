// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"errors"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"time"
)

type Reconciler interface {
	Reconcile() error
}

type ReconcilerFunc func() error

func (f ReconcilerFunc) Reconcile() error {
	return f()
}

type UsageReconciler struct {
	conn *gorm.DB
}

func NewUsageReconciler(conn *gorm.DB) *UsageReconciler {
	return &UsageReconciler{conn: conn}
}

type UsageReconcileStatus struct {
	StartTime time.Time
	EndTime   time.Time

	WorkspaceInstances        int
	InvalidWorkspaceInstances int

	Workspaces int
}

func (u *UsageReconciler) Reconcile() error {
	ctx := context.Background()
	now := time.Now().UTC()

	startOfCurrentMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	startOfNextMonth := startOfCurrentMonth.AddDate(0, 1, 0)

	status, err := u.ReconcileTimeRange(ctx, startOfCurrentMonth, startOfNextMonth)
	if err != nil {
		return err
	}
	log.WithField("usage_reconcile_status", status).Info("Reconcile completed.")
	return nil
}

func (u *UsageReconciler) ReconcileTimeRange(ctx context.Context, from, to time.Time) (*UsageReconcileStatus, error) {
	log.Infof("Gathering usage data from %s to %s", from, to)
	status := &UsageReconcileStatus{
		StartTime: from,
		EndTime:   to,
	}
	instances, invalidInstances, err := u.loadWorkspaceInstances(ctx, from, to)
	if err != nil {
		return nil, fmt.Errorf("failed to load workspace instances: %w", err)
	}
	status.WorkspaceInstances = len(instances)
	status.InvalidWorkspaceInstances = len(invalidInstances)

	if len(invalidInstances) > 0 {
		log.WithField("invalid_workspace_instances", invalidInstances).Errorf("Detected %d invalid instances. These will be skipped in the current run.", len(invalidInstances))
	}
	log.WithField("workspace_instances", instances).Debug("Successfully loaded workspace instances.")

	workspaces, err := u.loadWorkspaces(ctx, instances)
	if err != nil {
		return nil, fmt.Errorf("failed to load workspaces for workspace instances in time range: %w", err)
	}
	status.Workspaces = len(workspaces)

	return status, nil
}

type workspaceWithInstances struct {
	Workspace db.Workspace
	Instances []db.WorkspaceInstance
}

func (u *UsageReconciler) loadWorkspaces(ctx context.Context, instances []db.WorkspaceInstance) ([]workspaceWithInstances, error) {
	var workspaceIDs []string
	for _, instance := range instances {
		workspaceIDs = append(workspaceIDs, instance.WorkspaceID)
	}

	workspaces, err := db.ListWorkspacesByID(ctx, u.conn, toSet(workspaceIDs))
	if err != nil {
		return nil, fmt.Errorf("failed to find workspaces for provided workspace instances: %w", err)
	}

	// Map workspaces to corresponding instances
	workspacesWithInstancesByID := map[string]workspaceWithInstances{}
	for _, workspace := range workspaces {
		workspacesWithInstancesByID[workspace.ID] = workspaceWithInstances{
			Workspace: workspace,
		}
	}

	// We need to also add the instances to corresponding records, a single workspace can have multiple instances
	for _, instance := range instances {
		item, ok := workspacesWithInstancesByID[instance.WorkspaceID]
		if !ok {
			return nil, errors.New("encountered instance without a corresponding workspace record")
		}
		item.Instances = append(item.Instances, instance)
	}

	// Flatten results into a list
	var workspacesWithInstances []workspaceWithInstances
	for _, w := range workspacesWithInstancesByID {
		workspacesWithInstances = append(workspacesWithInstances, w)
	}

	return workspacesWithInstances, nil
}

func (u *UsageReconciler) loadWorkspaceInstances(ctx context.Context, from, to time.Time) ([]db.WorkspaceInstance, []invalidWorkspaceInstance, error) {
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

type invalidWorkspaceInstance struct {
	reason              string
	workspaceInstanceID uuid.UUID
}

func validateInstances(instances []db.WorkspaceInstance) (valid []db.WorkspaceInstance, invalid []invalidWorkspaceInstance) {
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
func trimStartStopTime(instances []db.WorkspaceInstance, maximumStart, minimumStop time.Time) []db.WorkspaceInstance {
	var updated []db.WorkspaceInstance

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

func toSet(items []string) []string {
	m := map[string]struct{}{}
	for _, i := range items {
		m[i] = struct{}{}
	}

	var result []string
	for s := range m {
		result = append(result, s)
	}
	return result
}
