// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package controller

import (
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/usage/pkg/db"
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

func NewUsageReconciler(conn *gorm.DB) *UsageReconciler {
	return &UsageReconciler{conn: conn}
}

type UsageReconciler struct {
	conn *gorm.DB
}

func (u *UsageReconciler) Reconcile() error {
	ctx := context.Background()
	now := time.Now().UTC()

	startOfCurrentMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	startOfNextMonth := startOfCurrentMonth.AddDate(0, 1, 0)

	return u.reconcile(ctx, startOfCurrentMonth, startOfNextMonth)
}

func (u *UsageReconciler) reconcile(ctx context.Context, from, to time.Time) error {
	log.Infof("Gathering usage data from %s to %s", from, to)
	instances, err := db.ListWorkspaceInstancesInRange(ctx, u.conn, from, to)
	if err != nil {
		return fmt.Errorf("failed to list instances: %w", err)
	}

	log.Infof("Identified %d instances between %s and %s", len(instances), from, to)
	return nil
}
