// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"io/ioutil"
	"os"
	"path/filepath"
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
	nowFunc func() time.Time
	conn    *gorm.DB
}

func NewUsageReconciler(conn *gorm.DB) *UsageReconciler {
	return &UsageReconciler{conn: conn, nowFunc: time.Now}
}

type UsageReconcileStatus struct {
	StartTime time.Time
	EndTime   time.Time

	WorkspaceInstances        int
	InvalidWorkspaceInstances int

	Workspaces int

	Teams int

	Report []TeamUsage
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

	// For now, write the report to a temp directory so we can manually retrieve it
	dir := os.TempDir()
	f, err := ioutil.TempFile(dir, fmt.Sprintf("%s-*", now.Format(time.RFC3339)))
	if err != nil {
		return fmt.Errorf("failed to create temporary file: %w", err)
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	err = enc.Encode(status.Report)
	if err != nil {
		return fmt.Errorf("failed to marshal report to JSON: %w", err)
	}

	stat, err := f.Stat()
	if err != nil {
		return fmt.Errorf("failed to get file stats: %w", err)
	}
	log.Infof("Wrote usage report into %s", filepath.Join(dir, stat.Name()))

	return nil
}

func (u *UsageReconciler) ReconcileTimeRange(ctx context.Context, from, to time.Time) (*UsageReconcileStatus, error) {
	now := u.nowFunc().UTC()
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

	// match workspaces to teams
	teams, err := u.loadTeamsForWorkspaces(ctx, workspaces)
	if err != nil {
		return nil, fmt.Errorf("failed to load teams for workspaces: %w", err)
	}
	status.Teams = len(teams)

	report, err := generateUsageReport(teams, now)
	if err != nil {
		return nil, fmt.Errorf("failed to generate usage report: %w", err)
	}
	status.Report = report

	return status, nil
}

func generateUsageReport(teams []teamWithWorkspaces, maxStopTime time.Time) ([]TeamUsage, error) {
	var report []TeamUsage
	for _, team := range teams {
		var teamTotalRuntime time.Duration
		for _, workspace := range team.Workspaces {
			for _, instance := range workspace.Instances {
				teamTotalRuntime += instance.TotalRuntime(maxStopTime)
			}
		}

		report = append(report, TeamUsage{
			TeamID:            team.TeamID.String(),
			WorkspacesRuntime: teamTotalRuntime,
		})
	}
	return report, nil
}

type teamWithWorkspaces struct {
	TeamID     uuid.UUID
	Workspaces []workspaceWithInstances
}

func (u *UsageReconciler) loadTeamsForWorkspaces(ctx context.Context, workspaces []workspaceWithInstances) ([]teamWithWorkspaces, error) {
	// find owner IDs of these workspaces
	var ownerIDs []uuid.UUID
	for _, workspace := range workspaces {
		ownerIDs = append(ownerIDs, workspace.Workspace.OwnerID)
	}

	// Retrieve memberships. This gives a link between an Owner and a Team they belong to.
	memberships, err := db.ListTeamMembershipsForUserIDs(ctx, u.conn, ownerIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to list team memberships: %w", err)
	}

	membershipsByUserID := map[uuid.UUID]db.TeamMembership{}
	for _, membership := range memberships {
		// User can belong to multiple teams. For now, we're choosing the membership at random.
		membershipsByUserID[membership.UserID] = membership
	}

	// Convert workspaces into a lookup so that we can index into them by Owner ID, needed for joining Teams with Workspaces
	workspacesByOwnerID := map[uuid.UUID][]workspaceWithInstances{}
	for _, workspace := range workspaces {
		workspacesByOwnerID[workspace.Workspace.OwnerID] = append(workspacesByOwnerID[workspace.Workspace.OwnerID], workspace)
	}

	// Finally, join the datasets
	// Because we iterate over memberships, and not workspaces, we're in effect ignoring Workspaces which are not in a team.
	// This is intended as we focus on Team usage for now.
	var teamsWithWorkspaces []teamWithWorkspaces
	for userID, membership := range membershipsByUserID {
		teamsWithWorkspaces = append(teamsWithWorkspaces, teamWithWorkspaces{
			TeamID:     membership.TeamID,
			Workspaces: workspacesByOwnerID[userID],
		})
	}

	return teamsWithWorkspaces, nil
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

	workspacesByID := map[string]db.Workspace{}
	for _, workspace := range workspaces {
		workspacesByID[workspace.ID] = workspace
	}

	// We need to also add the instances to corresponding records, a single workspace can have multiple instances
	instancesByWorkspaceID := map[string][]db.WorkspaceInstance{}
	for _, instance := range instances {
		instancesByWorkspaceID[instance.WorkspaceID] = append(instancesByWorkspaceID[instance.WorkspaceID], instance)
	}

	// Flatten results into a list
	var workspacesWithInstances []workspaceWithInstances
	for workspaceID, workspace := range workspacesByID {
		workspacesWithInstances = append(workspacesWithInstances, workspaceWithInstances{
			Workspace: workspace,
			Instances: instancesByWorkspaceID[workspaceID],
		})
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

type TeamUsage struct {
	TeamID            string        `json:"team_id"`
	WorkspacesRuntime time.Duration `json:"workspaces_runtime"`
}
